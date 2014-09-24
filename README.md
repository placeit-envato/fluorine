Fluorine
========

Fluorine - Flow based programing abstraction.

Fluorine can simply be though of as an abstraction or a DSL.
It is a structure of code in which you can manage complex asynchronous
code with ease.

Probably one of the most important features of Fluorine is its
non-intrusive philosophy, since it separates code from structure.

This "structure" is though of as a flow within a graph, where each node
in the graph is a function that runs some synchronous or asynchronous
code.

Now, even though this sounds very simple, it is quite powerful, because
you can code the "flow" which is the order in which functions will run,
and then go ahead and code the behavior that will run within each node
separately.

This simple fact, allows for clean, maintainable, simpler and atomic code.
Removing callback-hells, nesting, smells, complexity.

You may not realize until you get there, but refactoring a flow consists
of re-arranging the order of the nodes, while on the other hand you'll
probaly produce a lot of bugs while trying to refactor all the mixed,
nested complexity that lies in front of you. That is.. if you return
alive from mordor.

Now, within the Fluorine world, the program is a graph, the execution of
the program is called a flow and each node is called a step.

Let us Orchestrate asynchronous and synchronous code!

Usage
=====

Basically you instantiate a flow.
Then you add a step to the flow.
Any step can have other steps as dependencies.

When the program runs, it will run each step only if all of its
dependencies have been met.

Dependencies/Requirements
=========================

Require the libraries needed for Fluorine
1. [Neon](https://github.com/azendal/neon)
2. [CustomEventSupport](https://github.com/azendal/neon) (part of the
Neon stdlib)
3. [NodeSupport](https://github.com/azendal/neon) (part of the
Neon stdlib)

Geting Started
==============

Suppose you need to execute two asynchronous functions (someAsyncFn,
anotherAsyncFn) and when both are resolved execute something with the
response of the previous asynchronous functions.

```javascript
var flow = new Flow({name: 'test'});

flow.step('bar')(function (step) {
    someAsyncFn(function (someData) {
        step.success(someData);
    });
});

flow.step('baz')(function (step) {
    anotherAsyncFn(function (moreData) {
        step.success(moreData);
    });
});

flow.step('foo').dependsOn('bar', 'baz')(function (step) {
    // step.data.bar has someData as passed by the bar step
    // step.data.baz has moreData as passed by the baz step
    // Execute something else and then finish
    step.success();
});
```

Examples
========

No more coupling async methods with unecessary nesting, let suppose
you have fn1, fn2, fn3 and fn4 which are function that are asynchronous,
and you want to call them in sequence after each other

Using nested callbacks
```javascript
fn1(function () {
    // execute some code
    fn2(function () {
        // more code
        fn3(function () {
            // ...
            fn4(function () {
                // finalize
            });
        });
    });
});
```

Using Fluorine

```javascript
var f = new Flow({name: 'testFlow'});

f.step('1')(function (step) {
    // execute some code
    fn1(step.success);
});

f.step('2').dependsOn('1')(function (step) {
    // more code
    fn2(step.success);
});

flow.step('3').dependsOn('2')(function (step) {
    // ...
    fn3(step.success);
});

flow.step('4').dependsOn('3')(function (step) {
    // finalize
    fn4(step.success);
});
```

Let run fn1, fn2 and fn3 and only execute fn4 after the previous funcitons finish
```javascript
var f = new Flow({name:'dependentFlow'});

f.step('1')(function (step) {
    fn1(step.success);
});

f.step('2')(function (step) {
    fn2(step.success);
});

f.step('3')(function (step) {
    fn3(step.success);
});

f.step('4').dependsOn('1', '2', '3')(function (step) {
    fn4(step.success);
});
```

Execute fn1 and fn2 then when both are ready execute fn3 and then fn4
```javascript
var f = new Flow({name: 'lastFlow'});

f.step('1')(function (step) {
    fn1(step.success);
});

f.step('2')(function (step) {
    fn2(step.success);
});

f.step('3').dependsOn('1', '2')(function (step) {
    fn3(step.success);
});

f.step('4').dependsOn('3')(function (step) {
    fn4(step.success);
});
```

Error handling
--------------

If you want to handle errors in the execution of one of your nodes, you can
pass an additional function parameter to the step execution, that will be
called in case of error.

To trigger an error, you must explicitely call `step.fail(error)` for other
nodes to be notified

```javascript
var f = new Flow({ name : 'flow' })

f.step('foo')(function(step) {
    step.success();
});

f.step('bar')(function(step) {
    errorData = { error : 'some' };
    step.fail(errorData);
});

f.step('baz').dependsOn('foo', 'bar')(function(step) {
    // This won't be executed
}, function(step) {
    console.log("Error: ", step.errors.bar);
});
```