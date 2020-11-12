---
layout: post
title:  "Rust tidbits"
date:   2020-08-19
categories: rust 
---

- TOC
{:toc}

## Neat Features

### 1. `NonZeroI32` and `Option<NonZeroI32>`

For when you want to work with integers that can't be or aren't zero.

`Option<i32>` isn't ideal since it requires 32 bits for the integer 
representation and one bit plus padding for the option indicator.
If your goal is to have `None` represent zero, this is wasteful.
Rust optimizes `Option<NonZeroI32>` so that its in-memory representation
requires 32 bits.
This makes arrays and other collections of these numbers nicely aligned.

Other variants like `NonZeroU64` and `NoneZeroI8` exist as well.

### 2. `itertools::Position`

Have you ever needed to process a list with special logic for 
the first and/or last elements?
This iterator adaptor makes implementing this special casing
super clean.
`Itertools::with_position` allows you to adapt an iterator into
one where all the elements are wrapped by the `Position` enum.

```rust
enum Position<T> {
    First(T),
    Middle(T),
    Last(T),
    Only(T),
}

let it = [1, 2, 3].iter().with_position();
assert_eq!(
    it.collect(),
    vec![Position::First(1), Position::Middle(2), Position::Last(3)],
);

let it = [4].iter().with_position();
assert_eq!(it.collect(), vec![Position::Only(4)]);
```

Suppose you want to render a grid of characters without any trailing
spaces or trailing newlines.
Maybe this grid is super big too, so it'd be expensive to do 
string joins.
Then what you'd want to do is iterate over all the elements and
only print spaces or newlines if you know you're between elements:

```rust
let grid = [
    [1, 2, 3],
    [4, 5, 6],
];

let render_row = |row: &[i32]| {
    row.iter()
        .with_position()
        .for_each(|element| match element {
            Position::First(element) | Position::Only(element) => {
                print!("{}", element);
            }
            Position::Middle(element) | Position::Last(element) => {
                print!(" {}", element);
            }
        });
};

grid.iter().with_position().for_each(|row| match row {
    Position::First(row) | Position::Only(row) => {
        render_row(row);
    }
    Position::Middle(row) | Position::Last(row) => {
        println!();
        render_row(row);
    }
});
```

## Inconsistencies

### 1. `println!("{}", move_me)`

Although `println!` is a macro and not a function, macros are written as
if they are function invocations.
And in Rust, arguments passed into function calls are moved.
But this clearly isn't the case for `println!`:

```rust
let mut s = "Hi".to_string();
println!("{}", s);
s.push('p');       // OK.
my_print("{}", s); // Moved.
s.push('p');       // ERROR. Value borrowed after move.
```

Okay, but why does this matter? Macros and functions aren't the same,
so why should we expect them to behave the same?

Well it turns out macros in Rust's standard library aren't consistent
internally either. Take a look at `write!`'s API:

```rust
let mut buffer = String::new();
let hour = "10".to_string();
let mut minute = "15".to_string();
write!(&mut buffer, "{}:{}", hour, minute)?;
minute.pop();      // OK.
```

The macro reads as if it takes a mutable reference to a buffer (it does)
and then a list of arguments by value (it doesn't -- it automatically
passes them by reference).

Okay, but maybe these macros all take references by default and the
distinction is just that mutable references need to be specified?
Well, that's not the case either.
Enter `dbg!`.

```rust
let mut s = "Hi".to_string();
dbg!(s);
s.push('p');    // ERROR. Value borrowed after move.
```

`dbg!` moves the argument, so we end up not being able to use `s`
after passing it into `dbg!`.
The reason `dbg!` works this way is that 

> Invoking the macro on an expression moves and takes ownership of it
> before returning the evaluated expression unchanged.
> If the type of the expression does not implement `Copy`
> and you don't want to give up ownership,
> you can instead borrow with `dbg!(&expr)` for some expression `expr`.

The first point makes it super useful for debugging:

```rust
let mut s = "Hi".to_string();
// s.push(get_suffix());
// Hm not sure what get_suffix is returning -- let me check.
s.push(dbg!(get_suffix()));
```

### 2. Another `print!` inconsistency

Anyone who has tried to write an interactive CLI tool in Rust has probably
encountered this one.
Imagine a confirmation prompt

```rust
print!("Are you sure? (y/n): ");
let answer = read_input()?;
```

Surprisingly, when you run this nothing appears.
Rust's stdout implementation is line buffered
(<https://github.com/rust-lang/rust/blob/5a6a41e7847ff5f85a31b87431ce2af29c567f1d/library/std/src/io/stdio.rs#L488-L490>)
so `print!` by itself won't flush to stdout.
You'll either need to add a newline (`\n` or `println!`)
or manually invoke `std::io::stdout().flush()`.
