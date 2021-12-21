<img src="https://user-images.githubusercontent.com/17712692/133390147-a572a191-9deb-4376-8070-9687607090d6.png" style="width: 300px;"/>

# Rapider

A tool for quickly making beautiful, maintainable, and consistent CLIs.

- [Rapider](#rapider)
  - [Why?](#why)
  - [Getting Started](#getting-started)
  - [Example](#example)
    - [List Animals](#list-animals)
    - [Add Command](#add-command)
    - [Build](#build)
  - [Types](#types)
  - [Rules](#rules)
- [All Features](#all-features)
  - [Rapider UI](#rapider-ui)
    - [Input](#input)
      - [List](#list)
    - [Logs](#logs)
      - [Indent](#indent)
      - [Progress Bar](#progress-bar)
      - [Spinner](#spinner)
    - [Data](#data)
      - [Table](#table)
      - [List](#list-1)
  - [Rapider Types](#rapider-types)
    - [string](#string)
    - [int](#int)
    - [float](#float)
    - [presence](#presence)
    - [list](#list)
    - [date](#date)
    - [path](#path)
  - [Rapider Rules](#rapider-rules)
    - [oneOf](#oneof)
    - [allOneOf](#alloneof)
    - [notPartOf](#notpartof)
    - [noneArePartOf](#nonearepartof)
    - [unique](#unique)
    - [length](#length)
    - [required](#required)
    - [greaterThan, lessThan](#greaterthan-lessthan)
    - [positive, negative](#positive-negative)
    - [Custom rules](#custom-rules)
  - [Rapider Store](#rapider-store)
    - [Register store](#register-store)
    - [Set an item](#set-an-item)
    - [Get an item](#get-an-item)
    - [Update an item](#update-an-item)
    - [Append to an array.](#append-to-an-array)

## Why?

For many projects in software, building out a CLI is inevitable. Whether it's the project itself, or just a tool to make life easier for the developers, a CLI can be a highly efficient way to get things done.

With that said, building out a good CLI can be a PITA. Many times, you end up re-inventing the wheel to get simple things done, only to have flakey, hard to maintain results.

Rapider is a simple, expressive way to quickly generate CLI tools.

## Getting Started

A Rapider CLI is simply an object conforming to the rapider.ICli type. In other words,

```ts
const cli: rapider.ICli = {};
```

That's it! While it doesn't do anything yet, we could run it as is:

```ts
const cli: rapider.ICli = {};
rapider.run(cli);
```

That's it, your first Rapider CLI...of course, you want to build something useful. Read on.

## Example

We'll build a simple `farm` API. We want methods to do the following:

- List animals in the farm
- Add a new animal to the farm, by name.
- Build either a new house, or a new barn.

First of all, we should describe what our CLI does.

```ts
const cli: rapider.ICli = {
  name: "Farm",
  description: "Manage our farm.",
};
```

Assuming we have this in a file called `barnyard.ts`, we can now run `ts-node barnyard.ts --help`, and get an automatic help message!

### List Animals

Of course, we want actual commands. We'd like to be able to list animals with a command like: `ts-node barnyard.ts list`. This is the type of hierarchical command we find a lot in CLIs.

In Rapider-speak, we call this a "scope". The `const cli = {...}` is a scope, and it can have nested scopes, e.g, `list`. When a scope has no nested scopes, we call it a `command`. Pretty straight forward, right?

So, to add our list command, we add the following to `cli`.

```ts
const cli: rapider.ICli = {
  name: "Farm",
  description: "Manage our farm.",
  scopes: {
    list: {},
  },
};
```

Now, `list` is just another instance of `rapider.iCli`. We can add functionality as follows.

```ts
const cli: rapider.ICli = {
  name: "Farm",
  description: "Manage our farm.",
  scopes: {
    list: {
      handler: async () => {
        rapider.ui.LOG("Animals: pig,cow,sheep");
      },
    },
  },
};
```

We've hard-coded it for now, but you can have any arbitrary code in there. Notice that it is in a promise, so you can do things like access files, hit a server, no problem.

The list command was pretty simple, it took no arguments. Let's check out a more advanced example.

### Add Command

Now when we add animals, we want to accept some animal from the user. In rapider-speak, this is a `flag`. Flags can either be `positional`, or `named`. Let's make this one named.

```ts
const cli: rapider.ICli = {
  name: "Farm",
  description: "Manage our farm.",
  scopes: {
    list: {...},
    add: {
        flags: {
            named: [
                {key: "animal", type: rapider.flags.types.string()}
            ]
        }
    }
  },
};
```

Notice that this is of type string, rapider has tons of other types we can use as well.

Let's add some functionality for this add method.

```ts
const cli: rapider.ICli = {
  name: "Farm",
  description: "Manage our farm.",
  scopes: {
    list: {...},
    add: {
        flags: {
            named: [
                {key: "animal", type: rapider.flags.types.string()}
            ]
        },
        handler: async (flags) => {
            rapider.ui.LOG(`Adding ${flags.animal} to the farm.`)
        }
    }
  },
};
```

Now, we can call this via the following command:

```bash
ts-node barnyard.ts add --animal pig
```

Not bad, right! The nested objects let us intuitively understand the structure of the CLI, while focusing only on the parts we care about.

Note that if we really wanted, we could accept animal as a `positional` argument instead.

```ts
add: {
    flags: {
        positional: [
            {key: "animal", type: rapider.flags.types.string()}
        ]
    },
    handler: async (flags) => {
        rapider.ui.LOG(`Adding ${flags.animal} to the farm.`)
    }
}
```

```bash
ts-node barnyard.ts add pig
```

While this has less characters to type...it's also less clear, so stick to named flags when possible. That said, if efficiency is important to you, you can always add alternate versions of your named flags.

```ts
flags: {
    named: [
        {
            key: "animal",
            aliases: ["a", "name"]
            type: rapider.flags.types.string()
        }
    ]
},
```

This would expose the flag as any of the following: `--animal, -a, --name`.

### Build

Okay, let's take a look at our most complicated example: the "build" command. There's a few rules we'd like to enforce here.

- We can build either a house or a barn. These are similar...but different.
- Houses require some number of rooms, barns require some number of pens.
- Both houses and barns can be made of the same materials: wood, metal, or stone, and we should default to wood.

Doing this from scratch, it could get pretty spaghetti-code like, very quickly. Let's see how rapider handles it. Take a look at the full code below, with an explanation afterwards. It looks a bit long, but it's super simple, and just builds on what we already did.

```ts
const cli: rapider.ICli = {
  name: "Farm",
  description: "Manage our farm.",
  scopes: {
    list: {...},
    add: {},
    build: {
        flags: {
            named: [{
                key: "material",
                type: rapider.flags.types.string(),
                rules: [rapider.flags.rules.oneOf(() => ["wood", "metal", "stone"])],
                default: "wood"
            }]
        },
        scopes: {
            house: {
                flags: {
                    named: [{
                        key: "rooms",
                        type: rapider.flags.types.int(),
                        rules: [rapider.flags.rules.required()]
                    }]
                },
                handler: async (flags) => {
                    rapider.ui.LOG(`Making a house out of ${flags.material} with ${flags.rooms} rooms.`);
                }
            },
            barn: {
                flags: {
                    named: [{
                        key: "pens",
                        type: rapider.flags.types.int(),
                        rules: [rapider.flags.rules.required()]
                    }]
                },
                handler: async (flags) => {
                    rapider.ui.LOG(`Making a barn out of ${flags.material} with ${flags.pens} pens.`);
                }
            }
        }
    }
  },
};
```

This code,

1. Makes a scope "build", with an argument "material".
2. Makes two subcommands, "house" and "barn". Each has a required, integer argument.

We now have access to the following CLI commands, as well as all help messages, type validation, etc, that's needed.

```
ts-node barnyard.ts build house --rooms 5
ts-node barnyard.ts build barn --pens 2
ts-node barnyard.ts build --material metal barn --pens 2
....
```

There's a couple really interesting things to unpack here, you're encouraged to look deeper into it, starting from below.

## Types

Rapider handles parsing and casting a variety of **types**, including strings, integers, floats, lists of all of these, etc. These are exposed under `rapider.flags.types`. You are also free to make your own, as long as they conform to the right interface.

## Rules

Rapider can enforce any number of `rules` against a flag. These can do things like enforce required-ness, string/list length, validating against a set of allowed values, enforcing list uniqueness, and much more. These are exposed in `rapider.flags.rules`.

To make it even more powerful, though, you can define your own custom rules, as long as they conform to the right interface. By default, **rapider rules are asynchronous**, meaning you could apply complex logic like validating against a backend.

# All Features

## Rapider UI

Tools to get/display data efficiently, handling complicated scenarios simply, and beautifully.

By leveraging Rapider's UI, you can enable far richer communication between your tool and the user, making it easier to use, and far more powerful.

### Input

`rapider.ui.input`

A collection of modules to handle common input scenarios. These are distinct from flags, in that they are intended for interactive use within your handlers.

#### List

`rapider.ui.input.list`

Presents a list of items to the user, allowing them to select one (supports multiple). Uses an interactive list of choices that the user can scroll and toggle.

```ts
const result = await rapider.ui.input.list({
  items: [
    { value: "apple", display: "Apple" },
    { value: "orange", display: "Orange" },
  ],
  // True to allow multiple results
  multiple: false,
});

// Output
// Use up/down to navigate, space to toggle, enter to confirm, ctrl-c to cancel.
// > [ ]  Apple
//   [x]  Orange
//

// Returns: ["apple", ...other selections...]
```

### Logs

`rapider.ui.logs`

Standardized logging, with color coding.

```ts
rapider.ui.logs.LOG("message"); // message
rapider.ui.logs.ERROR("message"); // ERROR: message (and throws)
rapider.ui.logs.FATAL("message"); // FATAL: message (and immediately exits)
rapider.ui.logs.WARN("message"); // WARN: message
rapider.ui.logs.INFO("message"); // INFO: message
rapider.ui.logs.SUCCESS("message"); //SUCCESS: message
```

In addition to the basic log messages, rapider also provides commonly needed utilities.

#### Indent

`rapider.ui.logs.indent`

Global indent management. You can use `rapider.ui.logs.indent.increase(), decrease(), reset()`, to set indent across all functions.

This will be respected by all rapider methods, including LOG, table, etc.

```ts
// Example
function parent() {
  rapider.ui.logs.LOG("starting operation.");

  rapider.ui.logs.indent.increase();
  for (let i = 0; i < 5; i += 1) {
    child(i);
  }
  rapider.ui.logs.indent.decrease();

  rapider.ui.logs.SUCCESS("done operation.");
}
function child(n) {
  rapider.ui.logs.LOG("child: " + n);
}

// Output
//
// starting operation
//   child 1
//   child 2
//   child 3
//   child 4
//   child 5
// SUCCESS: done operation
```

#### Progress Bar

`rapider.ui.logs.progressBar`

Notify user of status of a long running operation.

```ts
const progressBar = rapider.ui.logs.progressBar({ initial: 0 });
// Output:
// |---------------------| 0%
```

We can then update this using the `set` method, it will replace the drawn bar. NOTE: you cannot log anything _while_ a progress bar is being drawn, or it will be overwritten.

```ts
progressBar.set(0.5);
// Output:
// |===========----------| 50%
```

If there are messages you'd like to log in the progress bar, e.g alerts, current operation, etc, you can provide them to `set`.

```ts
progressBar.set(0.5, ["file1", "file2"]);
// Output:
// |===========----------| 50%
// ... file1
// ... file2
```

#### Spinner

`rapider.ui.logs.spinner`
Notify user of a long running operation, with indeterminate completion time.

```ts
const spinner = rapider.ui.logs.spinner({
  label, // default: Loading
});

// Outputs:
// Loading --==- (animated)

// Dismiss
spinner.dismiss();
```

Like progressBar, do NOT log anything else while a spinner is active.

### Data

`rapider.ui.data`

Standardized output of more complex data.

#### Table

`rapider.ui.data.table`

Output a pretty printed table.

```ts
rapider.ui.data
  .table({
    cols: { id: "ID", name: "Animal" },
    rows: [
      { id: 1, name: "Pig" },
      { id: 2, name: "Cow" },
      { id: 3, name: "Sheep" },
    ],
  })
  .print();

// Output:
//
// | ID | Animal | (bold)
// |  1 |    Pig |
// |  2 |    Cow |
// |  3 |  Sheep |
```

Also includes useful helpers to do things like filter, transform, sort, etc the data immutably.

```ts
rapider.ui.data
  .table({
    cols: { id: "ID", name: "Animal" },
    rows: [
      { id: 1, name: "Pig" },
      { id: 2, name: "Cow" },
      { id: 3, name: "Sheep" },
    ],
  })
  .filter.cols(["name"])
  .print();

// Output:
//
// | Animal | (bold)
// |    Pig |
// |    Cow |
// |  Sheep |
```

#### List

`rapider.ui.data.list`

Just a simpler version of the table, for only one column.

```ts
rapider.ui.data
  .list({
    title: "Animals",
    items: ["Pig", "Cow", "Sheep"],
  })
  .print();

// Output:
//
// | Animal | (bold)
// |    Pig |
// |    Cow |
// |  Sheep |
```

## Rapider Types

`rapider.flags.types`
Datatypes that rapider can parse and enforce against flags.

### string

`rapider.flags.types.string()`
A basic string datatype.

### int

`rapider.flags.types.int()`
Integer datatype, automatically casted.

### float

`rapider.flags.types.float()`
Float datatype, automatically casted.

### presence

`rapider.flags.types.presence()`
Simple unary flags, where being present maps to a boolean true.

- default: false

### list

```ts
// Defaults to a list of comma separated strings.
// Can supply any rapider type.

rapider.flags.types.list({
  separator, // default: ",",
  type, // default: rapider.flags.types.string()
});
```

### date

`rapider.flags.types.date()`

Accepts a date of any of the following formats, and casts to a JS Date.

- YYYY-MM-DD (also accepts single digit month, date)
- YYYY-MM
- YYYY

### path

`rapider.flags.types.path()`

Accepts either a relative or absolute file system path, and converts to an absolute one.

## Rapider Rules

`rapider.flags.rules`

Rules that rapider can enforce against flags.

Many rapider rules take parameters, and whenever they do, they accept a callback as the argument. Rapider will pass in all parsed flags there, so you can have rules that depend on other flags.

### oneOf

```ts
rapider.flags.rules.oneOf(() => ["allowedVal1", "allowedVal2"]);
```

Whether the flag is part of some allowed set of values. This can also depend on other flags.

```ts
rapider.flags.rules.oneOf((flags) => flags.someListFlag);
```

### allOneOf

```ts
rapider.flags.rules.allOneOf(() => ["allowedVal1", "allowedVal2"]);
```

Just like oneOf, but when the flag is itself a list.

### notPartOf

```ts
rapider.flags.rules.notPartOf(() => ["allowedVal1", "allowedVal2"]);
```

The negative complement of oneOf.

### noneArePartOf

```ts
rapider.flags.rules.notPartOf(() => ["allowedVal1", "allowedVal2"]);
```

The negative complement of allOneOf.

### unique

```ts
rapider.flags.rules.unique();
```

Enforce list flag to have unique elements.

### length

```ts
rapider.flags.rules.length(() => 5);
```

Enforce flag to have a fixed length. This can be applied to several flag types, including string, list, etc.

### required

```ts
rapider.flags.rules.required();
```

Flag must be passed.

### greaterThan, lessThan

```ts
rapider.flags.rules.greaterThan(() => new Date());
```

Whether flag is greater/less than some value. Can be used for integers, floats, dates, etc.

This is really convenient when combined with dependent rules. Say you have two dates, a `start` and `end`. We could enforce order:

```ts
// rules for 'end'
rapider.flags.rules.greaterThan((flags) => flags.start);
```

### positive, negative

```ts
rapider.flags.rules.positive();
```

Whether numeric flag is positive or negative.

```ts
rapider.flags.rules.pathExists({
  parent, //default: false
});
```

Whether a path flag exists, and is accessible to this process. If `parent: true`, checks for existence of the flag's _parent_ dir instead. This is useful if the flag is an output file, for example.

### Custom rules

Define arbitrary constraints on the flag, based on its value, other flags' values, or anything else.

```ts
rapider.flags.rules.custom(async (value, flags) => {
  // Check the value, compare to other flags, hit a server,
  // It's up to you.
  // Just return a boolean to indicate pass/fail.
});
```

## Rapider Store

Often times, we'd like a CLI tool to have some concept of state. Preferences, basic data, etc.

Many times, building out a server stack for this is overkill, and we'd like something local. But manually dealing with file loading, creation, etc, is a huge pain.

For this type of simple, JSON-able data, rapider provides a built in object store. Use this to store any type of key-value data: strings, numbers, objects, arrays, etc.

DO NOT use this to store sensitive information like passwords, it is stored in plain text on the local machine.

### Register store

`rapider.store.register`

Connect to a local rapider store, or if it doesn't exist, make it. Be wise here, the name you choose should be unique to your application. We recommend taking your apps name, and adding three random words to it. For example, "farm-manager" becomes "farm-manager-blueberry-ruby-hockey"

TODO: add methods to help with this.

```ts
const store = rapider.store.register("foo");
```

### Set an item

`rapider.store.set`

```ts
await store.set("name", "John Doe");

// You can also use nested properties.
await store.set("name.first", "John");
await store.set("name.last", "Doe");
```

### Get an item

`rapider.store.get`

```ts
const name = await store.get("name");
// name = {first: "John", last: "Doe"}

// You can also use nested properties.
const firstName = await store.get("name.first");
// firstName = "John"
```

### Update an item

`rapider.store.update`

```ts
await store.set("user.usage.count", 0);

// Later on...
store.update("user.usage.count", (count) => count + 1);
```

### Delete an item.
`rapider.store.delete`

```ts
const deletedData = await store.delete("path.to.item");
```

### Add an items with a unique key.

`rapider.store.add`

By default, we add items with a linearly increasing key. That is: 1, 2, 3...If an object is deleted, the key will not be reused.

```ts
await store.add("path.to.container", data);
```

We can also specify that a UUID based key be used instead.

```ts
await store.add("path.to.container", data, { key: "uuid" });
```

### Get key-based items.

`rapider.store.getKeyed`

It's a common pattern to store items in a key-value format, by some ID. When we retrieve these objects, it's convenient to have them as a list instead, with the ID field inlined per object. Rapider provides a convenience method for this.

```ts
const items = await store.getKeyed("path.to.container", data);
```

Here, items contains whatever object was saved, with an additional `key: string` field added in.

### Append to an array.

`rapider.store.append`

```ts
await store.append("user.todos", ["get milk", "walk dog"]);
```

### Update a specific element (or, elements) in an array.

`rapider.store.updateElement`

Update all elements that match some finder-function.

```ts
async function completeTodo(id) {
  await store.updateElement(
    "user.todos",
    (item) => item.id === id,
    (todo) => ({ ...todo, status: "done" })
  );
}
```

### Delete a specific element (or, elements) in an array.

`rapider.store.deleteElement`

Delete all elements that match some finder-function.

```ts
await store.deleteElement("user.todos", (item) => item.id === 1);
```
