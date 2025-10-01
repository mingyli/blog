---
layout: post
title: "Scaling Probability by Confidence"
date: 2025-09-30
tags: probability
use_math: true
---

<script src="https://cdn.plot.ly/plotly-3.0.3.min.js"></script>

Given an event with a binary outcome, you can model it with a Bernoulli
distribution with probability $p$. A probability of $0.5$ indicates a completely
uninformed belief about the event, while probabilities of $0$ and $1$ indicate
complete confidence about the outcome of the event.

For the [Crystal Ball Cup](https://mingyli.github.io/crystal-ball-cup/), we're
interested in defining a way to scale the probability by some confidence factor.
For a given probability $p$ we want some definition that has the following
properties:

- Scaling by a confidence of zero produces a probability of $0.5$
- Scaling by a confidence of one produces the same probability $p$
- Scaling by a confidence of infinity produces zero if $p$ is less than $0.5$,
  one if $p$ is greater than $0.5$, and $0.5$ if $p$ is equal to $0.5$

One way to achieve these properties is using the following method: multiplying
by the confidence scaling $c$ in the logit space of $p$. The logit function is
defined as the log of the odds of the event, or

$$
\mathsf{logit}(p) = \log \frac{p}{1-p}
$$

It has the nice property that its range is $(-\infty, \infty)$ and is symmetric
about zero, which helps us with the properties we want if we scale
multiplicatively. Rearranging, you find that its inverse is the standard
logistic function

$$
p = \frac{1}{1 + e^{-\mathsf{logit}(p)}} = \sigma(\mathsf{logit}(p))
$$

Putting it all together, to scale $p$ by confidence $c$, we want to take the
logit of $p$, multiply it by $c$, and then map it back to probability space with
$\sigma$.

$$
\mathsf{scale}_c(p) = \sigma(c \mathsf{logit}(p)) = \frac{1}{1 + e^{-c \mathsf{logit}(p)}}
$$

There's another form that shows this is equivalent to applying a temperature
scaling of $T = \frac{1}{c}$. Simplifying this expression gives you

$$
\mathsf{scale}_c(p) = \frac{p^c}{p^c + (1-p)^c}
$$


Here's an example visually. For $p = 0.75$ and $c = 2$, you would start at
$0.75$, go to its logit, multiply that by $2$, and then go back to the
probability space to get $0.9$. So guessing a probability of $0.9$ means you're
twice as confident as guessing $0.75$.

<div id="sigmoidDiv" style="width: 100%;"></div>
<script src="{{ '/assets/js/probability-confidence-scaling.js' | relative_url }}"></script>

This approach comes with some extra properties:
- It is easily invertible: scaling $p$ by $c$ then $\frac{1}{c}$ brings you back
  to $p$
- Scaling by a negative confidence has the effect of reversing the direction of
  the prediction

## Finding the optimal confidence scaling

In Crystal Ball Cup, each respondent submits a vector $p$ of probabilities, one
for each event. We use a logarithmic scoring rule to score each respondent. If
the outcomes are $y$, then the score is the following sum

$$ \mathsf{score}(p) = \sum_i y_i \log(p_i) + (1-y_i) \log(1-p_i) $$

Let $p_c = \mathsf{scale}_c(p)$. Then the score of the scaled probabilities
(eliding the index subscripts) is

$$ \mathsf{score}(p_c) = \sum_i y \log(p_c) + (1-y) \log(1-p_c) $$

Let's figure out what $c$ maximizes the score. Taking derivatives, we get

$$
\begin{align}
\mathsf{score}'(p_c) &= \sum_i (y - p_c) (\log p - \log (1-p)) \\

\mathsf{score}''(p_c) &= - \sum_i p_c (1 - p_c) (\log p - \log (1-p))^2
\end{align}
$$

Since the second derivative is negative, the score is concave in $c$ and is
maximized when the first derivative is zero. We can find the $c$ for which the
score is maximized using Newton's method by repeating $c \leftarrow c -
\frac{\mathsf{score}'(p_c)}{\mathsf{score}^{\prime\prime}(p_c)}$ until
convergence.

Here's a visual example. For $p = \begin{bmatrix} 0.4 & 0.6 & 0.75 \end{bmatrix}$ and
$y = \begin{bmatrix} 0 & 0 & 1 \end{bmatrix}$, the score as a function of $c$ looks
like this:

<div id="confidenceDiv" style="width: 100%;"></div>
<script src="{{ '/assets/js/optimal-confidence-scoring.js' | relative_url }}"></script>

Looks like the score would have been maximized if the probabilities were $1.76$
times as confident with the scaled probabilities $p_c = \begin{bmatrix} 0.33 &
0.67 & 0.87 \end{bmatrix}$.
