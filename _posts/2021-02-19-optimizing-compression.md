---
layout: tufte
title:  "Optimizing Compression"
date:   2021-02-19
tags:   integer programming optimization
use_math: true
---

[Robot Operating System (ROS)][ros] is a framework for writing
robotics software.
Robots running on ROS typically run multiple processes called nodes or modules,
which communicate with one another over a pub/sub system where topics
contain a variety of data: serialized messages[^1], images, audio, etc.
The messages sent over this pub/sub system are recorded in a log file
so that they can be played back after logs are offloaded from the robots.

{: class="marginnote"}
This has the effect of extending the robot's lifetime since
compression decreases the rate at which the disk is
filled up.

Since disk space is a scarce resource on a robot, it can be worthwhile to
apply compression to the messages as they're written to the log.
Different topics have different message types, meaning it's reasonable
to expect that certain compression algorithms work well on some topics and not
as well on others.
For example, a [compressor built for images][compression-methods] may not
perform as well as other compressors do on general bytes.

{: class="marginnote"}
There's also potential for improvements on the I/O side.
Applying compression does increase compute requirements, but compressing data
means less data is ultimately written to disk, and disks with lower write
speeds have an easier time keeping up.
The rest of this writeup doesn't consider I/O improvements though.

However, compute is also a scarce resource, meaning any compression efforts
should be careful not to incur so much compute cost that other modules running
on the robot are affected.
With these pieces in mind, we can formulate the task of figuring out which
compression algorithm to apply to each topic as an optimization problem.

## Formulation

A robotics log comprises $ n $ topics.
The sizes of the $ n $ topics are $ s_1, \cdots, s_n $ before compression.

{: class="marginnote"}
$ C_{i j} $ can be derived by comparing the rate at which data on topic
$ i $ is produced with the rate at which compressor $ j $ can compress that
data.
This is a simplification in that it uses average rates, whereas in reality
data on topic $ i $ might be published infrequently and cause spikier behavior.

There are $ m $ compression algorithms.
When compressor $ j $ is applied to topic $ i $, it's observed to have a
compression ratio of $ R_{i j} $ (the ratio between the compressed size and
the original size) while requiring $ C_{i j} $ CPU cores to perform the
compression.

We want to figure out the optimal assignment of compressors to topics to
minimize the total size of the compressed log, while constraining ourselves
to a CPU limit $ L $ on the compute used for compression.
We can use a matrix $ M $ to represent an assignment of compressors to topics,
where $ M_{i j} $ is an indicator for whether compressor $ j $ is applied to
topic $ i $.
Since each topic is assigned one compressor, each row in $ M $ is one-hot.

With these definitions, the size of the compressed log according to the
assignment $ M $ is

$$ \sum_{i=1}^n s_i \sum_{j=1}^m M_{i j} R_{i j} $$

and the total CPU used is

$$ \sum_{i, j} M_{i j} C_{i j} $$

resulting in the following zero-one linear program:

$$
\begin{align}
\min_{M} \quad      & \sum_{i=1}^n s_i \sum_{j=1}^m M_{i j} R_{i j} \\
\textrm{s.t.} \quad & M_{i j} \in \{ 0, 1 \} \quad \forall i, j \\
                    & \sum_{j=1}^m M_{i j} = 1 \quad \forall i \\
                    & \sum_{i, j} M_{i j} C_{i j} \leq L
\end{align}
$$

## Code

Now that the math is done, all that's left to do is translate this into code.
I'm a fan of Google's [OR-tools][ortools], but other libraries work too.

```python
import numpy as np
from ortools.linear_solver import pywraplp

NUM_TOPICS = 3
NUM_COMPRESSORS = 2
CPU_LIMIT = 0.5

topic_sizes = np.array([103.0, 45.0, 203.0])
compression_ratios = np.array([
    [0.7, 0.6],
    [0.6, 0.7],
    [0.5, 0.45],
])
cpu_cores = np.array([
    [0.13, 0.16],
    [0.12, 0.16],
    [0.2, 0.24],
])

solver = pywraplp.Solver.CreateSolver("SCIP")

# Assignment matrix.
M = np.array([
    [
        solver.IntVar(0.0, 1.0, f"M_{i}{j}")
	for j in range(NUM_COMPRESSORS)
    ]
    for i in range(NUM_TOPICS)
])

# Constraints on rows of assignment matrix.
for i in range(NUM_TOPICS):
    solver.Add(M[i,:].sum() == 1.0)

# Constraint on CPU usage.
total_cpu_cores = np.multiply(M, cpu_cores).sum()
solver.Add(total_cpu_cores <= CPU_LIMIT)

# Minimize the total compressed size of the log as the objective.
total_log_size = np.multiply(M, compression_ratios).sum(axis=1) @ topic_sizes
solver.Minimize(total_log_size)

status = solver.Solve()
assert status == pywraplp.Solver.OPTIMAL

compressed_size = total_log_size.solution_value()
cpu_usage = total_cpu_cores.solution_value()
assignment = np.vectorize(lambda var: var.solution_value())(M)
```

---

[^1]: ROS uses a [special message serialization format](http://wiki.ros.org/Messages) but I've worked with implementations that use Protocol Buffers instead.
[ros]: https://www.ros.org
[compression-methods]: https://en.wikipedia.org/wiki/Lossless_compression#Lossless_compression_methods
[ortools]: https://developers.google.com/optimization/introduction/overview
