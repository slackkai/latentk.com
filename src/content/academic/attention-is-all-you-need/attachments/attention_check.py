"""A constructed attention ledger; Python 3.10+, standard library only."""
from math import exp, isclose, log

def attend(scores, values, blocked=()):
    if len(scores) != len(values) or not scores:
        raise ValueError("one value is required for every score")
    allowed = [i for i in range(len(scores)) if i not in blocked]
    if not allowed:
        raise ValueError("at least one position must remain visible")
    shift = max(scores[i] for i in allowed)
    numerators = [exp(s - shift) if i in allowed else 0.0 for i, s in enumerate(scores)]
    total = sum(numerators)
    weights = [n / total for n in numerators]
    return weights, sum(w * v for w, v in zip(weights, values))

def main():
    scores, values = [0, log(2), log(3)], [0, 3, 6]
    weights, result = attend(scores, values)
    assert all(isclose(a, b) for a, b in zip(weights, [1/6, 2/6, 3/6]))
    assert isclose(result, 4)
    assert isclose(attend([s + 100 for s in scores], values)[1], 4)
    assert isclose(attend(scores, values, blocked=(2,))[1], 2)
    assert isclose(attend(scores, [0, 3, 12])[1], 7)
    assert isclose(attend(scores, [0, 3, 12], blocked=(2,))[1], 2)
    print("weights:", [round(w, 6) for w in weights])
    print("output: 4; +100 to all scores: 4; block third: 2; change last value: 7")
    print("PASS: all five checks; no trained model or external dependencies")

if __name__ == "__main__":
    main()
