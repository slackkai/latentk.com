"""Reproduce the article's constructed example. Python 3.10+, standard library only.

Usage: python analyze.py [results.csv]
These counts are teaching data, not results from a robot experiment.
"""

import argparse
import csv
import math
from pathlib import Path


def wilson(successes, trials, z=1.959963984540054):
    """Two-sided 95% Wilson score interval for independent Bernoulli trials."""
    if not 0 <= successes <= trials or trials <= 0:
        raise ValueError("Require 0 <= successes <= trials and trials > 0")
    rate = successes / trials
    scale = 1 + z * z / trials
    center = (rate + z * z / (2 * trials)) / scale
    radius = z * math.sqrt(rate * (1 - rate) / trials + z * z / (4 * trials**2)) / scale
    return center - radius, center + radius


def load_counts(path):
    counts = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["policy", "scene", "successes", "trials"]:
            raise ValueError("Unexpected CSV columns")
        for row in reader:
            key = row["policy"], row["scene"]
            if key in counts:
                raise ValueError(f"Duplicate group: {key}")
            successes, trials = int(row["successes"]), int(row["trials"])
            wilson(successes, trials)
            counts[key] = successes, trials
    expected = {(policy, scene) for policy in ("A", "B") for scene in ("easy", "hard")}
    if set(counts) != expected:
        raise ValueError("This example requires exactly A/B crossed with easy/hard")
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", nargs="?", type=Path, default=Path(__file__).with_name("results.csv"))
    args = parser.parse_args()
    counts = load_counts(args.csv)
    standardized = {}
    print("Constructed teaching data; intervals assume independent trials within each group.")
    for policy in ("A", "B"):
        total_successes = total_trials = 0
        rates = []
        for scene in ("easy", "hard"):
            successes, trials = counts[policy, scene]
            low, high = wilson(successes, trials)
            rates.append(successes / trials)
            total_successes += successes
            total_trials += trials
            print(f"{policy}/{scene}: {successes}/{trials} = {successes/trials:.1%}; "
                  f"Wilson 95% [{low:.1%}, {high:.1%}]")
        standardized[policy] = sum(rates) / 2
        print(f"{policy} observed mixture: {total_successes}/{total_trials} = "
              f"{total_successes/total_trials:.1%}")
        print(f"{policy} equal-weight target: {standardized[policy]:.1%}")
    print(f"Equal-weight difference B-A: "
          f"{100 * (standardized['B'] - standardized['A']):+.1f} percentage points")
    print("The weighted difference is a point estimate, not proof of superiority.")


if __name__ == "__main__":
    main()
