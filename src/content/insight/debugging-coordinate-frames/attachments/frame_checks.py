"""Synthetic coordinate-frame checks; no robot connection or third-party packages.

Convention: column vectors; R_BC maps C coordinates into B coordinates.
Run with Python 3.10+: python frame_checks.py
"""

from math import isclose

R_BC = ((0.0, -1.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0))
T_BC = (0.4, -0.2, 0.5)


def mv(matrix, vector):
    return tuple(sum(a * b for a, b in zip(row, vector)) for row in matrix)


def transpose(matrix):
    return tuple(zip(*matrix))


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def subtract(a, b):
    return tuple(x - y for x, y in zip(a, b))


def near(a, b):
    return all(isclose(x, y, rel_tol=0.0, abs_tol=1e-12) for x, y in zip(a, b))


def to_base(point_c):
    return add(mv(R_BC, point_c), T_BC)


def to_camera(point_b):
    return mv(transpose(R_BC), subtract(point_b, T_BC))


def main():
    fixtures = [
        ((0.0, 0.0, 0.0), (0.4, -0.2, 0.5)),
        ((0.1, 0.0, 0.0), (0.4, -0.1, 0.5)),
        ((0.0, 0.1, 0.0), (0.3, -0.2, 0.5)),
        ((0.0, 0.0, 0.1), (0.4, -0.2, 0.6)),
        ((0.1, 0.2, 1.0), (0.2, -0.1, 1.5)),
    ]
    for point_c, expected_b in fixtures:
        assert near(to_base(point_c), expected_b), (point_c, expected_b)
        assert near(to_camera(expected_b), point_c), point_c
    print("PASS: origin, three basis directions, target point, and inverse mapping")

    point_c = (0.1, 0.2, 1.0)
    wrong_b = add(mv(transpose(R_BC), point_c), T_BC)
    wrong_round_trip = mv(R_BC, subtract(wrong_b, T_BC))
    assert near(wrong_round_trip, point_c)
    assert not near(wrong_b, to_base(point_c))
    print("Wrong forward result:", tuple(round(x, 3) for x in wrong_b))
    print("PASS: the wrong forward/inverse pair passes a round trip but fails the known target")

    a, b = fixtures[1][0], fixtures[2][0]
    distance_squared = lambda p, q: sum((x - y) ** 2 for x, y in zip(p, q))
    assert isclose(distance_squared(a, b), distance_squared(to_base(a), to_base(b)), abs_tol=1e-12)
    print("PASS: rigid transform preserves distance (necessary, not sufficient)")


if __name__ == "__main__":
    main()
