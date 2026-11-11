# Synthesized score + SFX for the Wukong test (numpy only). Everything ends before the last word ends.
import numpy as np, wave, sys
SR = 48000
DUR = 1146 / 30
N = int(DUR * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
mus = np.zeros(N); sfx = np.zeros(N)
def add(buf, x, at):
    i = int(at * SR); x = x[: max(0, N - i)]; buf[i:i + len(x)] += x
def env(n, a=0.005, d=1.0):
    e = np.exp(-np.arange(n) / SR / d); k = int(a * SR); e[:k] *= np.linspace(0, 1, k); return e
def pluck(freq, dur=1.6, bright=0.5):
    # Karplus-Strong: guzheng-like plucked string
    n = int(dur * SR); p = max(2, int(SR / freq)); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = bright * buf[i % p] + (1 - bright) * 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return out * env(n, 0.002, dur / 3)
def tone(freq, dur, amp=1.0, a=0.3, d=None):
    n = int(dur * SR); x = np.sin(2 * np.pi * freq * np.arange(n) / SR) * amp
    e = np.minimum(1, np.arange(n) / (a * SR)) * np.minimum(1, (n - np.arange(n)) / (a * SR)); return x * e
def gong(f0=98, dur=4.0):
    n = int(dur * SR); x = np.zeros(n); tt = np.arange(n) / SR
    for r, a in [(1, 1), (1.47, .6), (2.09, .45), (2.56, .3), (3.3, .2)]:
        x += a * np.sin(2 * np.pi * f0 * r * tt * (1 + 0.002 * np.exp(-tt))) * np.exp(-tt / (dur / (1 + r)))
    return x * env(n, 0.004, dur)
def noise(dur, lp=0.2):
    n = int(dur * SR); x = rng.normal(0, 1, n); y = np.zeros(n); s = 0
    for i in range(n): s += lp * (x[i] - s); y[i] = s
    return y
penta = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99, 880.0]
# --- plucked melody (calm 0-10.7, playful 25-34.8), sparse drone everywhere
def melody(t0, t1, step, seed, vol):
    r = np.random.default_rng(seed); i = 4; tt = t0
    while tt < t1:
        i = int(np.clip(i + r.choice([-2, -1, 1, 1, 2]), 0, len(penta) - 1))
        if r.random() > 0.2: add(mus, pluck(penta[i] / (2 if r.random() < 0.3 else 1), 1.4) * vol, tt)
        tt += step
melody(0.2, 10.4, 0.36, 1, 0.5)
melody(25.2, 34.6, 0.24, 2, 0.5)
for a, b, f in [(0, 10.7, 73.42), (10.7, 14.4, 73.42), (14.4, 23.5, 110.0), (29.3, 34.85, 73.42)]:
    add(mus, (tone(f, b - a, 0.18, 0.8) + tone(f * 1.5, b - a, 0.08, 0.8)), a)
# crack riser + gong on the split, shimmer for the beams
add(sfx, noise(0.6, 0.5) * np.linspace(0, 0.5, int(0.6 * SR)), 12.85)
for k in range(5): add(sfx, noise(0.05, 0.9) * 0.6 * env(int(0.05 * SR), 0.001, 0.02), 13.0 + k * 0.09)
add(sfx, gong(82, 4.5) * 0.55, 13.45)
for k, f in enumerate([1318.5, 1760, 2349.3, 2637]):
    add(sfx, tone(f, 2.6, 0.06, 0.3) * np.exp(-np.arange(int(2.6 * SR)) / SR / 1.2), 18.1 + k * 0.06)
add(sfx, gong(196, 2.5) * 0.25, 21.65)
add(sfx, gong(130.8, 3.2) * 0.4, 23.6)  # the gods freeze
# leap whoosh + waterfall roar
w = noise(1.8, 0.08); add(sfx, w * np.sin(np.linspace(0, np.pi, len(w))) * 1.2, 26.95)
r = noise(2.6, 0.35); add(sfx, r * np.minimum(1, np.linspace(0, 3, len(r))) * np.minimum(1, np.linspace(4, 0, len(r))) * 0.45, 27.6)
add(sfx, gong(220, 3.0) * 0.35, 33.3)   # the crown
# ominous end: low dissonant pad that fades out before the last word ends
add(mus, tone(55, 3.0, 0.22, 0.6) + tone(58.27, 3.0, 0.12, 0.6), 34.9)
mix = mus * 0.55 + sfx * 0.7
# hard rule: silence after the narration (last word ends 38.05 s): fade by 37.95
end = int(37.95 * SR); mix[end:] = 0; fl = int(0.5 * SR); mix[end - fl:end] *= np.linspace(1, 0, fl)
mix /= max(1e-9, np.abs(mix).max()); mix *= 0.5
with wave.open(sys.argv[1], "wb") as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", DUR)
