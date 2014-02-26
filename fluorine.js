Class('Flow').includes(CustomEventSupport, NodeSupport)({
    prototype : {
        name : '',
        init : function (config) {
            Object.keys(config).forEach(function (property) {
                this[property] = config[property];
            }, this);
        },

        step : function (name) {
            var flow = this;
            var dependencies = [];
            var nodeFactory = function (code, errorCode) {
                var node = new FlowNode({
                    name : name,
                    code : code,
                    errorCode : errorCode,
                    dependencies : dependencies
                });

                flow.appendChild(node);

                dependencies.forEach(function (dependencyName) {
                    flow.bind(dependencyName, function () {
                        flow.runNode(node);
                    });
                });

                flow.runNode(node);
            }
            nodeFactory.dependsOn = function () {
                dependencies = Array.prototype.slice.call(arguments, 0);
                return nodeFactory;
            };

            return nodeFactory;


        },

        runNode : function (node) {
            var dependencies = [].concat(node.dependencies);
            var hasRejectedDependency = false;

            var fulfilledDependencies = dependencies.filter(function (dependencyName) {
                if (this.hasOwnProperty(dependencyName) === false) {
                    return;
                }

                if (this[dependencyName].isFulfilled === true || this[dependencyName].isRejected === true) {
                    if (this[dependencyName].isRejected === true) {
                        hasRejectedDependency = true;
                    }
                    return true;
                }
            }, this);

            if (dependencies.length === fulfilledDependencies.length) {
                var nodeLikeObject = {
                    success : function nodeSuccess(data) {
                        node.fulfill(data);
                    },
                    fail : function nodeFail(error) {
                        node.reject(error);
                    }
                };

                if (hasRejectedDependency === false) {
                    nodeLikeObject.data = {};
                    fulfilledDependencies.forEach(function (dependencyName) {
                        nodeLikeObject.data[dependencyName] = this[dependencyName].data;
                    }, this);
                }
                else {
                    nodeLikeObject.errors = {};
                    fulfilledDependencies.forEach(function (dependencyName) {
                        nodeLikeObject.data[dependencyName] = this[dependencyName].error;
                    }, this);
                }

                node.run(nodeLikeObject);
            }
        },

        destroy : function destroy() {
            this.children.forEach(function (child) {
                child.destroy();
            });

            return null;
        },

        toDot : function toDot() {
            var dotGraph = [];
            dotGraph.push("digraph " + this.name + " {");

            this.children.forEach(function (step) {
                dotGraph.push(step.name);
                step.dependencies.forEach(function (dependencyName) {
                    dotGraph.push(dependencyName + " -> " + step.name);
                });
            });

            dotGraph.push("}");

            console.debug("Put this in a file and run this in a terminal: dot -Tsvg yourDotFile > graph.svg");
            return dotGraph.join("\n");
        }
    }
});

Class('FlowNode').includes(NodeSupport)({
    prototype : {
        name : '',
        data : undefined,
        error : undefined,
        isFulfilled : false,
        isRejected : false,
        code : function () { throw 'no code'; },
        errorCode : undefined,
        init : function (config) {
            Object.keys(config).forEach(function (property) {
                this[property] = config[property];
            }, this);
        },

        run : function (nodeLikeObject) {
            var node = this;
            if (nodeLikeObject.hasOwnProperty('data') === true) {
                window.setTimeout(function runFlowNode() {
                    node.code(nodeLikeObject);
                }, 0);
            }
            else if (typeof this.errorCode !== 'undefined') {
                window.setTimeout(function runFlowNodeError() {
                    node.errorCode(nodeLikeObject);
                }, 0);
            }
        },

        fulfill : function (data) {
            this.data = data;
            this.isFulfilled = true;
            this.parent.dispatch(this.name);
        },

        reject : function (error) {
            this.error = error;
            this.isRejected = true;
            this.parent.dispatch(this.name);
        },

        destroy : function destroy() {
            this.parent.removeChild(this);

            return null;
        }
    }
});
