/**
Flow is the class that represents an application flow of steps to meet
a goal for an application.
@class Flow
@namespace Global
@requires CustomEventSupport
@requires NodeSupport
**/
Class('Flow').includes(CustomEventSupport, NodeSupport)({
    prototype : {
        /**
        holder for the name of the flow
        @property name <public> [String]
        **/
        name : '',

        /**
        initializer for the class
        @property init <public> [Function]
        @argument config <optional> [Object]
        **/
        init : function init(config) {
            Object.keys(config).forEach(function (property) {
                this[property] = config[property];
            }, this);
        },

        /**
        Define a step in the flow. this is a dsl like starter because returs functions.
        flowInstance.step('name')(function (step) {...});
        @property step <public> [Function]
        @argument name <required> [String]
        @return Function a closure to the created step that you can use either to finish the step
        creation or define more metadata.
        **/
        step : function step(name) {
            var flow, dependencies, nodeFactory;

            flow = this;
            dependencies = [];
            
            nodeFactory = function nodeFactory(code, errorCode) {
                var node = new FlowNode({
                    name : name,
                    code : code,
                    errorCode : errorCode,
                    dependencies : dependencies
                });

                flow.appendChild(node);

                dependencies.forEach(function dependenciesIterator(dependencyName) {
                    flow.bind(dependencyName, function () {
                        flow.runNode(node);
                    });
                });

                flow.runNode(node);
            };

            nodeFactory.dependsOn = function dependsOn() {
                dependencies = Array.prototype.slice.call(arguments, 0);
                return nodeFactory;
            };

            return nodeFactory;


        },

        /**
        Checks for a node candidate to run, in order to run this node
        all its preconditions must be met (dependencies completed). after this steps
        pass it creates the appropiete data that will pass to the node and finally
        it executes the node passing a capability object to this step that contains
        the data from its dependencies.
        @property runNode <public> [Function]
        @argument node <required> [FlowNode] the node that you want to execute.
        **/
        runNode : function runNode(node) {
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
                    fulfilledDependencies.forEach(function fulfilledDependenciesIterator(dependencyName) {
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

        /**
        A flow basically is a graph which implies that the garbage collector will not be able
        to clear this objects if they are no longer needed by the developer.
        this method takes care of clearing those references and gives the developer full control
        of when to discard the flow.
        @property destroy <public> [Function]
        **/
        destroy : function destroy() {
            this.children.forEach(function (child) {
                child.destroy();
            });

            return null;
        },
 
        /**
        This is a utility method to introspect a flow. flow use case is for when a complex sequence
        needs to be solved and its very hard to solve it by simpler programming constructs, so mapping
        this sequences is hard, this method dumps the flow into a dot directed graph to be visualized.
        @property toDot <public> [Function]
        @return string The actual dot string that represents this flow graph.
        **/
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

/**
This class represents a step in a flow, it does care what the step actually executes
because the execution code is provided as a property of the node.
@class FlowNode
@namespace Global
@requires NodeSupport
**/
Class('FlowNode').includes(NodeSupport)({
    prototype : {
        /**
        holds the name of the step
        @property name <public> [String] ('')
        **/
        name : '',

        /**
        holds the data for the step once the data gets resolved and will get the value that
        the step wants to pass
        @property data <public> [Object] (undefined)
        **/
        data : undefined,

        /**
        This is very similar to the data property but is intended for steps that fail
        @property error <public> [Object] (undefined)
        **/
        error : undefined,

        /**
        Nodes behave like promises and this parameter holds a boolean when the promise
        is fulfilled or not. if a promise is rejected this will remain on false.
        @property isFulfilled <public> [Boolean] (false)
        **/
        isFulfilled : false,

        /**
        Nodes behave like promises and this parameter holds a boolean when the promise
        is rejected or not. if a promise is fulfilled this will remain on false.
        @property isRejected <public> [Boolean] (false)
        **/
        isRejected : false,

        /**
        Every step takes care of its context in the flow it belongs to but has noting to
        do with the step implementation, this property holds the actual code that the step
        will execute when it runs.
        @property code <public> [Function] (function () { trow 'no code' })
        **/
        code : function () { throw 'no code'; },

        /**
        Nodes can be rejected and this code is different from the success code. Similar to
        the code property this holds the code for the error execution code provided.
        @property errorCode <public> [Function] (undefined)
        **/
        errorCode : undefined,

        /**
        class initializer
        **/
        init : function (config) {
            Object.keys(config).forEach(function (property) {
                this[property] = config[property];
            }, this);
        },

        /**
        Executes the node. This is done via a setTimeout to release the stack depth.
        Even thought it is required for events to be synchronous, a flow step does
        not represent a safe data signal propagation, instead is a pass to other process
        like behavior.
        @property run <public> [Function]
        @argument FlowNode <required> [Object]
        @return Undefined
        **/
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

        /**
        method to notify that the step executed succesfully.
        @property fulfill <public> [Function]
        **/
        fulfill : function (data) {
            this.data = data;
            this.isFulfilled = true;
            this.parent.dispatch(this.name);
        },

        /**
        method to notify that the step executed wrong.
        @property reject <public> [Function]
        **/
        reject : function (error) {
            this.error = error;
            this.isRejected = true;
            this.parent.dispatch(this.name);
        },

        /**
        Removes itself from the flow allowing that the garbage collector
        removes this object cleanly
        @property destroy <public> [Function]
        **/
        destroy : function destroy() {
            this.parent.removeChild(this);

            return null;
        }
    }
});
