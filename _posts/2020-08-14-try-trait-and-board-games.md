---
layout: post
title:  "`try_trait` and board games"
date:   2020-08-14 19:05:18 -0700
categories: rust 
---

In Rust, `?` is a special operator that is commonly used to signal an early return if an error is encountered. 
It's one of the first lessons in the Rust book, which includes [many examples][rust-book] for how it can be used.

The [original implementation][original-implementation] of the `?` operator was syntactic sugar for writing 

```rust
match <expr> {
    Ok(val) => val,
    Err(err) => return Err(From::from(err)),
}
```

as `<expr>?`.
You might recognize this as shorthand for writing the Go equivalent for error handling

```go
val, err := <expr>
if err != nil {
    return nil, err
}
```

`?` is huge in Rust because of how much it improves readability of code, allowing us to write concise code while handling errors.
[`try_trait`][try-trait] is a feature that allows Rust programmers to use the `?` operator on types other than `Result`s,
so that types implementing the `Try` trait can use `?` for any short-circuiting logic. 

# Short-circuiting

There’s a whole suite of higher-order functions under [Iterator][iterator] that demonstrate short-circuiting logic: 
[`try_find`][try-find], [`try_fold`][try-fold], and [`try_for_each`][try-for-each].
Each of these try-flavored methods takes in a function that returns something of the type `Try` and applies that function to the elements in the iterator,
stopping once the function fails.
For example, here’s how `try_for_each` behaves:

```rust
let mut it = [1, 2, -3, 4, -5].iter();
let result = it.try_for_each(|&i| {
    if i < 0 {
        Err(format!("Value {} is negative.", i))
    } else {
        Ok(())
    }
});
assert_eq!(result, Err("Value -3 is negative.".to_string()));
assert_eq!(it.next(), Some(&4));
```

As long as the closure returns `Ok`, iteration continues as normal, but upon reaching an `Err`, the iteration short-circuits and returns that result. 
As we can see in the example, the remaining elements aren't consumed after the iteration short-ciruits.

`Result` is probably the most commonly used type that implements the `Try` trait, but `Option` implements `Try` as well.
We can modify the closure in the above example to return an `Option` instead, and it behaves in a similar way,
with `Some` acting as an analogue for `Ok` and `None` for `Err`:

```rust
let mut it = [1, 2, -3, 4, -5].iter();
let option = it.try_for_each(|&i| {
    if i < 0 {
        None
    } else {
        Some(())
    }
});
assert_eq!(option, None);
assert_eq!(it.next(), Some(&4));
```

# Tic-tac-toe

Rust’s algebraic data types make the language a great choice for describing board game state.
If we’re implementing tic-tac-toe, we might come up with the following data structures to encode the state of the board:

```rust
enum Player {
    X,
    O,
}

struct State {
    board: [Option<Player>; 9],
}
```

And then to manage the progression of the game, we can create a wrapper around the board
to manage game state as it transitions between different phases.

```rust
enum Phase {
    InProgress(State),
    Win(State, Player),
    Tie(State),
}

fn transition(mut state: State, input: &Input) -> Phase {
    state.apply_input(input);
    if let Some(winner) = state.winner() {
        Phase::Win(state, winner)
    } else if state.is_tie() {
        Phase::Tie(state)
    } else {
        Phase::InProgress(state)
    }
}
```

With these data structures in place, we can write a really pretty game loop that looks something along the lines of

```rust
let mut phase = Phase::InProgress(State::initial());
while let Phase::InProgress(state) = phase {
    let input = read_input();
    phase = transition(state, &input);
}
println!("Game over!\n{}", phase);
```

One thing we notice about our implementation is that there’s a lot of short-circuiting logic: 
we short-circuit in `transition` if we notice the game is over (someone has won or there’s a tie), 
and the main loop breaks once the game is no longer in progress. 
This sounds like the perfect use case for `try_trait`. 

If we draw analogues between `Phase` and `Result`, we see that `Phase::InProgress` and `Result::Ok` 
are both values that indicate whether execution should continue, while `Phase::Win`, `Phase::Tie`, 
and `Result::Err` indicate that execution should halt. 
The target behavior we’d want looks like this:

```rust
fn test_result() -> Result<u32, &'static str> {
    Ok(4)?;
    Err("This value is returned.")?;
    Ok(3)
}
fn test_phase() -> Phase {
    Phase::InProgress(State { ... })?;
    Phase::Win(State { ... }, Player::X)?; // This value is returned.
    Phase::Tie(State { ... })
}
```

With this in mind, we can implement `Try` for `Phase` like so:

```rust
impl Try for Phase {
    type Ok = State;
    type Error = (State, Option<Player>);

    fn into_result(self) -> Result<Self::Ok, Self::Error> {
        match self {
            Phase::InProgress(state) => Ok(state),
            Phase::Win(state, winner) => Err((state, Some(winner))),
            Phase::Tie(state) => Err((state, None)),
        }
    }

    // Indicate short-circuiting behavior.
    fn from_error((state, player): Self::Error) -> Self {
        match player {
            None => Phase::Tie(state),
            Some(winner) => Phase::Win(state, winner),
        }
    }

    // Indicate resuming behavior.
    fn from_ok(v: Self::Ok) -> Self {
        Phase::InProgress(v)
    }
}
```

Now that we’ve enabled the `?` operator on `Phase`, we can go back and rewrite our transition logic:

```rust
fn check_win(state: State) -> Phase {
    if let Some(winner) = state.winner() {
        Phase::Win(state, winner)
    } else {
        Phase::InProgress(state)
    }
}

fn check_tie(state: State) -> Phase {
    if state.is_tie() {
        Phase::Tie(state)
    } else {
        Phase::InProgress(state)
    }
}

fn transition(mut state: State, input: &Input) -> Phase {
    state.apply_input(input);
    state = check_win(state)?;
    state = check_tie(state)?;
    Phase::InProgress(state)
}
```

## Applying `try_fold`

When we think about playing the game as a whole, we’re really just taking an initial state (an empty board) 
and applying a sequence of modifications to it (placing marks in cells) until we obtain a final state. 
This procedure can be generalized as taking a `fold` over the sequence of `Input`s, with a seed value of the initial 
state `State::initial()` and a combining function `transition`. 
Conveniently, we also need to stop execution as soon as we detect that the game is over, 
which is behavior that `try_fold` offers. 
This observation makes writing unit tests for this game a joy:

```rust
let inputs = [
    Input {
        position: 0,
        player: Player::X,
    },
    Input {
        position: 8,
        player: Player::O,
    },
    Input {
        position: 1,
        player: Player::X,
    },
    Input {
        position: 7,
        player: Player::O,
    },
    Input {
        position: 2,
        player: Player::X,
    },
    // X has won at this point, so no more inputs are processed.
    Input {
        position: 6,
        player: Player::O,
    },
];
let end = inputs.iter().try_fold(State::initial(), State::transition);
assert_eq!(
    end,
    Phase::Win(
        State {
            board: [
                Some(Player::X),
                Some(Player::X),
                Some(Player::X),
                None,
                None,
                None,
                None,
                Some(Player::O),
                Some(Player::O),
            ]
        }, 
        Player::X
    )
);
```

A complete implementation of tic-tac-toe using this pattern is available at <https://github.com/mingyli/tictactoe-rs>. 

[try-trait]:   https://doc.rust-lang.org/beta/unstable-book/library-features/try-trait.html
[rust-book]:   https://doc.rust-lang.org/edition-guide/rust-2018/error-handling-and-panics/the-question-mark-operator-for-easier-error-handling.html
[original-implementation]: https://github.com/japaric/rust/blob/2de4932453a99a19e9033edb47db7a66a612188c/src/librustc_front/lowering.rs#L1613-L1620
[iterator]:    https://doc.rust-lang.org/std/iter/trait.Iterator.html
[try-find]:    https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.try_find
[try-fold]:    https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.try_fold
[try-for-each]: https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.try_for_each
