/* WYSITyp prototype – sample workspace, notes, symbols, shapes and shortcuts. */
"use strict";

const TAGS = {
  Analiza: "blue",
  Fizyka: "green",
  Algebra: "violet",
  "Na egzamin": "amber",
  Lab: "teal",
  Plan: "gray",
};

const WORKSPACES = {
  sem3: {
    name: "Studia · semestr 3",
    path: "~/Dokumenty/WYSITyp/Semestr 3",
    tree: [
      {
        id: "f-an",
        name: "Analiza matematyczna",
        dir: "Analiza",
        children: [
          { id: "f-an-w", name: "Wykłady", dir: "Wyklady", children: ["n-w7", "n-w6"] },
          { id: "f-an-c", name: "Ćwiczenia", dir: "Cwiczenia", children: ["n-c3", "n-l4"] },
          "n-l5",
        ],
      },
      { id: "f-fiz", name: "Fizyka", dir: "Fizyka", children: [{ id: "f-fiz-lab", name: "Laboratoria", dir: "Laboratoria", children: ["n-lab2"] }, "n-kin"] },
      { id: "f-alg", name: "Algebra liniowa", dir: "Algebra", children: ["n-alg1", "n-alg2"] },
      "n-plan",
    ],
  },
  sem2: {
    name: "Studia · semestr 2",
    path: "~/Dokumenty/WYSITyp/Semestr 2",
    tree: [{ id: "f-an1", name: "Analiza I", dir: "Analiza I", children: ["n-s2a", "n-s2b"] }, "n-s2c"],
  },
};

/* Icons and colours the student can give a note or folder. Colours are theme tokens (--ic-*) so both themes keep contrast. */
const DECO_COLORS = [
  { id: "", label: "Domyślny" },
  { id: "red", label: "Czerwony" },
  { id: "orange", label: "Pomarańczowy" },
  { id: "amber", label: "Bursztynowy" },
  { id: "green", label: "Zielony" },
  { id: "teal", label: "Morski" },
  { id: "blue", label: "Niebieski" },
  { id: "violet", label: "Fioletowy" },
  { id: "pink", label: "Różowy" },
];
const DECO_ICONS = {
  note: ["file", "book", "bookmark", "sigma", "func", "grid", "atom", "flask", "chart", "code", "globe", "bulb", "star", "heart", "flag", "calendar", "cap", "edit"],
  folder: ["folder", "book", "cap", "sigma", "func", "grid", "atom", "flask", "chart", "code", "globe", "bulb", "star", "heart", "flag", "calendar", "package", "bookmark"],
};
const DECO_DEFAULTS = {
  "f-an": { icon: "sigma", color: "blue" },
  "f-fiz": { icon: "atom", color: "green" },
  "f-fiz-lab": { icon: "flask", color: "teal" },
  "f-alg": { icon: "grid", color: "violet" },
  "n-plan": { icon: "calendar", color: "amber" },
  "n-w7": { color: "red" },
};

const NOTES = {
  "n-w7": {
    title: "Wykład 7 – całka Riemanna",
    file: "wyklad-07.typ",
    tags: ["Analiza", "Na egzamin"],
    date: "wczoraj, 10:15",
    excerpt: "Podział przedziału, sumy górne i dolne, kryterium całkowalności, podstawowe twierdzenie rachunku całkowego…",
    source: `#import "lecture.typ": lecture
#show: lecture.with(date: "2026-11-06")

= Całka Riemanna

Niech funkcja będzie *ograniczona* na przedziale domkniętym, $f : [a, b] -> RR$. Jeśli jest ciągła, zachodzi podstawowe twierdzenie rachunku całkowego:

$ integral_a^b f(x) dif x = F(b) - F(a) $

- funkcja pierwotna spełnia $F' = f$,
- całka nie zależy od wyboru #highlight[funkcji pierwotnej].

#quote[Całka to granica sum, a nie pole – pole to tylko interpretacja.]

#definition[Funkcja $f$ jest _całkowalna w sensie Riemanna_, gdy sumy górne i dolne mają wspólną granicę przy średnicy podziału dążącej do zera.]

== Zbieżność

Ciąg sum Riemanna $S_n = sum_(i=1)^n f(xi_i) Delta x_i$ zbiega, gdy średnica podziału dąży do zera.

#theorem(title: "Kryterium całkowalności")[Każda funkcja ciągła na $[a, b]$ jest całkowalna.]

Przybliżenie numeryczne, funkcja \`integrate()\`:

\`\`\`py
def integrate(f, a, b, n=1000):
    h = (b - a) / n
    return h * sum(f(a + i * h) for i in range(n))
\`\`\`

Warunek na resztę: $x^2 +
// TODO: dopisać kryterium Cauchy'ego`,
  },
  "n-w6": {
    title: "Wykład 6 – pochodne",
    file: "wyklad-06.typ",
    tags: ["Analiza"],
    date: "30 października",
    excerpt: "Definicja przez granicę ilorazu różnicowego, reguła łańcuchowa, twierdzenie Lagrange’a…",
    source: `#import "lecture.typ": lecture
#show: lecture.with(date: "2026-10-30")

= Pochodne

#definition[Pochodną funkcji $f$ w punkcie $x_0$ nazywamy granicę ilorazu różnicowego:]

$ f'(x_0) = lim_(h -> 0) (f(x_0 + h) - f(x_0)) / h $

== Reguły różniczkowania

- liniowość: $(a f + b g)' = a f' + b g'$,
- iloczyn: $(f g)' = f' g + f g'$,
- reguła łańcuchowa: $(f compose g)'(x) = f'(g(x)) dot g'(x)$.

#table(
  columns: 3,
  stroke: (x: none),
  table.header([*Funkcja*], [*Pochodna*], [*Uwagi*]),
  [$x^n$], [$n x^(n-1)$], [$n in RR$],
  [$sin x$], [$cos x$], [],
  [$e^x$], [$e^x$], [jedyna taka funkcja],
  [$ln x$], [$1/x$], [$x > 0$],
)

#theorem(title: "Lagrange’a")[Jeśli $f$ jest ciągła na $[a, b]$ i różniczkowalna na $(a, b)$, to istnieje $c in (a, b)$ takie, że $f'(c) = (f(b) - f(a)) / (b - a)$.]`,
  },
  "n-c3": {
    title: "Ćwiczenia 3",
    file: "cwiczenia-03.typ",
    tags: ["Analiza"],
    date: "23 października",
    excerpt: "Całkowanie przez podstawienie, t = x², granice całkowania po zamianie zmiennej…",
    source: `= Ćwiczenia 3

Całkowanie przez podstawienie, $t = x^2$, granice całkowania po zamianie zmiennej.

#exercise[Oblicz $integral_0^1 x e^(x^2) dif x$.]

Podstawiamy $t = x^2$, więc $dif t = 2 x dif x$:

$ integral_0^1 x e^(x^2) dif x = 1/2 integral_0^1 e^t dif t = (e - 1) / 2 $

#note[Pamiętaj o zmianie granic całkowania – to najczęstszy błąd na kolokwium.]

#exercise[Oblicz $integral sin^3 x dif x$.]`,
  },
  "n-l4": {
    title: "Lista 4 – szeregi",
    file: "lista-04.typ",
    tags: ["Analiza", "Na egzamin"],
    date: "28 października",
    excerpt: "Zad. 3: zbadać zbieżność szeregu ∑ 1/(n ln n) kryterium całkowym…",
    source: `= Lista 4 – szeregi

+ Zbadaj zbieżność szeregu $sum_(n=1)^infinity 1 / n^2$.
+ Pokaż, że szereg harmoniczny jest rozbieżny.
+ Zbadaj zbieżność szeregu $sum_(n=2)^infinity 1 / (n ln n)$ kryterium całkowym.

#note[Kryterium całkowe: szereg i całka $integral_2^infinity 1/(x ln x) dif x$ są jednocześnie zbieżne albo rozbieżne.]`,
  },
  "n-l5": {
    title: "Całki niewłaściwe",
    file: "lista-05.typ",
    tags: ["Analiza"],
    date: "4 listopada",
    excerpt: "Całki na przedziale nieskończonym i z funkcji nieograniczonej…",
    source: `= Całki niewłaściwe

/ Pierwszego rodzaju: całka na przedziale nieskończonym, np. $integral_1^infinity 1/x^2 dif x = 1$.
/ Drugiego rodzaju: całka z funkcji nieograniczonej, np. $integral_0^1 1/sqrt(x) dif x = 2$.

Całka $integral_1^infinity 1/x^p dif x$ jest zbieżna dokładnie dla $p > 1$.`,
  },
  "n-lab2": {
    title: "Laboratorium 2 – wahadło",
    file: "lab-02.typ",
    tags: ["Fizyka", "Lab"],
    date: "5 listopada",
    excerpt: "Wyznaczanie przyspieszenia ziemskiego z okresu drgań wahadła matematycznego…",
    source: `= Laboratorium 2 – wahadło matematyczne

== Cel

Wyznaczenie przyspieszenia ziemskiego $g$ z okresu drgań wahadła.

== Aparatura

- nić o regulowanej długości i kulka stalowa,
- stoper (dokładność $0.01 "s"$),
- taśma miernicza.

== Pomiary

#table(
  columns: 3,
  table.header([*$l$ [m]*], [*$10 T$ [s]*], [*$T$ [s]*]),
  [0.40], [12.71], [1.271],
  [0.60], [15.55], [1.555],
  [0.80], [17.94], [1.794],
)

$ T = 2 pi sqrt(l / g) quad => quad g = 4 pi^2 l / T^2 $

== Wnioski

Otrzymano $g approx 9.79 "m/s"^2$, zgodnie z wartością tablicową w granicach niepewności.`,
  },
  "n-kin": {
    title: "Kinematyka – notatki",
    file: "kinematyka.typ",
    tags: ["Fizyka"],
    date: "29 października",
    excerpt: "Prędkość i przyspieszenie jako pochodne położenia, ruch jednostajnie zmienny…",
    source: `= Kinematyka

Prędkość to pochodna położenia: $arrow(v) = (dif arrow(r)) / (dif t)$, przyspieszenie to pochodna prędkości.

$ s(t) = s_0 + v_0 t + (a t^2) / 2 $

#cetz.canvas({ line((0,0), (4,2.4), mark: (end: ">")) })

Wektor prędkości jest styczny do toru ruchu.`,
  },
  "n-alg1": {
    title: "Macierze – wykład 1",
    file: "macierze-01.typ",
    tags: ["Algebra"],
    date: "27 października",
    excerpt: "Działania na macierzach, wyznacznik macierzy 2 × 2…",
    source: `= Macierze

Macierz $A$ wymiaru $m times n$ zapisujemy jako

$ A = mat(a_11, a_12; a_21, a_22) $

#definition[Wyznacznik macierzy $2 times 2$: $det A = a_11 a_22 - a_12 a_21$.]

- mnożenie macierzy nie jest przemienne: na ogół $A B != B A$,
- $det(A B) = det A dot det B$.`,
  },
  "n-alg2": {
    title: "Przestrzenie liniowe",
    file: "przestrzenie.typ",
    tags: ["Algebra", "Na egzamin"],
    date: "3 listopada",
    excerpt: "Baza, wymiar, kombinacje liniowe i podprzestrzenie…",
    source: `= Przestrzenie liniowe

#definition[Układ wektorów $v_1, dots, v_n$ jest _bazą_ przestrzeni $V$, gdy jest liniowo niezależny i rozpina $V$.]

#theorem[Każde dwie bazy przestrzeni skończenie wymiarowej mają tyle samo elementów: $dim V = n$.]`,
  },
  "n-plan": {
    title: "Plan semestru",
    file: "plan.typ",
    tags: ["Plan"],
    date: "1 października",
    excerpt: "Terminy kolokwiów, egzaminy i konsultacje…",
    source: `= Plan semestru

#table(
  columns: 3,
  table.header([*Przedmiot*], [*Kolokwium*], [*Egzamin*]),
  [Analiza matematyczna], [20 listopada], [3 lutego],
  [Fizyka], [27 listopada], [6 lutego],
  [Algebra liniowa], [4 grudnia], [10 lutego],
)

- konsultacje z analizy: wtorki, 12:15, s. 204,
- oddać sprawozdanie z laboratorium 2 do *15 listopada*.`,
  },
  "n-s2a": {
    title: "Granice ciągów",
    file: "granice.typ",
    tags: ["Analiza"],
    date: "12 maja",
    excerpt: "Definicja granicy ciągu, twierdzenie o trzech ciągach…",
    source: `= Granice ciągów

$ lim_(n -> infinity) (1 + 1/n)^n = e $

#theorem(title: "o trzech ciągach")[Jeśli $a_n <= b_n <= c_n$ oraz $a_n -> g$ i $c_n -> g$, to $b_n -> g$.]`,
  },
  "n-s2b": {
    title: "Ciągłość funkcji",
    file: "ciaglosc.typ",
    tags: ["Analiza"],
    date: "19 maja",
    excerpt: "Definicja Cauchy’ego i Heinego…",
    source: `= Ciągłość funkcji

Funkcja $f$ jest ciągła w $x_0$, gdy $lim_(x -> x_0) f(x) = f(x_0)$.`,
  },
  "n-s2c": {
    title: "Notatki różne",
    file: "rozne.typ",
    tags: [],
    date: "2 czerwca",
    excerpt: "Luźne notatki z semestru…",
    source: `= Notatki różne

Tu trafiają rzeczy, które nie pasują nigdzie indziej.`,
  },
  "n-loose": {
    title: "kolokwium-2025",
    file: "kolokwium-2025.typ",
    loose: true,
    path: "~/Pobrane/kolokwium-2025.typ",
    tags: [],
    date: "dziś",
    excerpt: "Zadania z ubiegłorocznego kolokwium…",
    source: `= Kolokwium 2025 – zadania

+ Oblicz $lim_(x -> 0) (sin x) / x$.
+ Wyznacz ekstrema funkcji $f(x) = x^3 - 3 x$.`,
  },
};

const TEMPLATES = [
  { id: "blank", name: "Pusta notatka", file: "", icon: "file", desc: "Czysta strona bez szablonu.", body: "= {title}\n\n" },
  {
    id: "lecture",
    name: "Wykład",
    file: "lecture.typ",
    icon: "file",
    desc: "Tytuł, data, prowadzący i miejsce na definicje oraz twierdzenia.",
    body: '#import "lecture.typ": lecture\n#show: lecture.with(date: "{date}")\n\n= {title}\n\n#definition[]\n\n#theorem[]\n',
  },
  {
    id: "problems",
    name: "Lista zadań",
    file: "problem-set.typ",
    icon: "math",
    desc: "Numerowane zadania z miejscem na rozwiązanie i odpowiedź.",
    body: "= {title}\n\n#exercise[Treść zadania.]\n\n_Rozwiązanie._\n\n#exercise[Treść zadania.]\n",
  },
  {
    id: "lab",
    name: "Laboratorium",
    file: "lab.typ",
    icon: "table",
    desc: "Cel, aparatura, tabela pomiarów, niepewności i wnioski.",
    body: "= {title}\n\n== Cel\n\n== Aparatura\n\n- \n\n== Pomiary\n\n#table(\n  columns: 3,\n  table.header([*Wielkość*], [*Wartość*], [*Niepewność*]),\n  [], [], [],\n)\n\n== Wnioski\n",
  },
];

/* [glyph, typst name, section] */
const SYMBOLS = [
  ...[
    ["α", "alpha"], ["β", "beta"], ["γ", "gamma"], ["δ", "delta"], ["ε", "epsilon"], ["ζ", "zeta"], ["η", "eta"],
    ["θ", "theta"], ["ι", "iota"], ["κ", "kappa"], ["λ", "lambda"], ["μ", "mu"], ["ν", "nu"], ["ξ", "xi"],
    ["π", "pi"], ["ρ", "rho"], ["σ", "sigma"], ["τ", "tau"], ["υ", "upsilon"], ["φ", "phi"], ["χ", "chi"],
    ["ψ", "psi"], ["ω", "omega"], ["ϵ", "epsilon.alt"], ["ϑ", "theta.alt"], ["ϕ", "phi.alt"], ["Γ", "Gamma"],
    ["Δ", "Delta"], ["Θ", "Theta"], ["Λ", "Lambda"], ["Ξ", "Xi"], ["Π", "Pi"], ["Σ", "Sigma"], ["Φ", "Phi"],
    ["Ψ", "Psi"], ["Ω", "Omega"],
  ].map((s) => [...s, "greek"]),
  ...[
    ["+", "plus"], ["−", "minus"], ["±", "plus.minus"], ["∓", "minus.plus"], ["×", "times"], ["÷", "div"],
    ["·", "dot.op"], ["∘", "compose"], ["⊕", "plus.circle"], ["⊗", "times.circle"], ["∑", "sum"], ["∏", "product"],
    ["∫", "integral"], ["∬", "integral.double"], ["∮", "integral.cont"], ["∂", "diff"], ["∇", "nabla"], ["√", "sqrt"],
    ["∞", "infinity"], ["′", "prime"],
  ].map((s) => [...s, "ops"]),
  ...[
    ["=", "eq"], ["≠", "eq.not"], ["≈", "approx"], ["≡", "equiv"], ["∼", "tilde.op"], ["≅", "tilde.equiv"],
    ["<", "lt"], [">", "gt"], ["≤", "lt.eq"], ["≥", "gt.eq"], ["≪", "lt.double"], ["≫", "gt.double"],
    ["∝", "prop"], ["⊥", "perp"], ["∥", "parallel"], ["∣", "divides"], ["≺", "prec"], ["≻", "succ"],
  ].map((s) => [...s, "rel"]),
  ...[
    ["→", "arrow.r"], ["←", "arrow.l"], ["↔", "arrow.l.r"], ["⇒", "arrow.r.double"], ["⇐", "arrow.l.double"],
    ["⇔", "arrow.l.r.double"], ["↦", "arrow.r.bar"], ["⟶", "arrow.r.long"], ["⟹", "arrow.r.double.long"],
    ["↑", "arrow.t"], ["↓", "arrow.b"], ["↕", "arrow.t.b"], ["↪", "arrow.r.hook"], ["⇀", "harpoon.rt"],
    ["⇝", "arrow.r.squiggly"], ["↗", "arrow.tr"], ["↘", "arrow.br"], ["⟼", "arrow.r.long.bar"],
  ].map((s) => [...s, "arr"]),
  ...[
    ["∈", "in"], ["∉", "in.not"], ["∋", "in.rev"], ["⊂", "subset"], ["⊆", "subset.eq"], ["⊃", "supset"],
    ["⊇", "supset.eq"], ["∪", "union"], ["∩", "sect"], ["∖", "without"], ["∅", "emptyset"], ["∀", "forall"],
    ["∃", "exists"], ["∄", "exists.not"], ["¬", "not"], ["∧", "and"], ["∨", "or"], ["⊤", "top"], ["⊥", "bot"],
    ["ℕ", "NN"], ["ℤ", "ZZ"], ["ℚ", "QQ"], ["ℝ", "RR"], ["ℂ", "CC"], ["∴", "therefore"], ["∵", "because"],
  ].map((s) => [...s, "sets"]),
  ...[
    ["∞", "infinity"], ["∂", "diff"], ["∇", "nabla"], ["ℏ", "planck.reduce"], ["ℓ", "ell"], ["°", "degree"],
    ["∠", "angle"], ["△", "triangle.stroked.t"], ["…", "dots.h"], ["⋯", "dots.h.c"], ["⋮", "dots.v"],
    ["⋱", "dots.down"], ["⌊", "floor.l"], ["⌋", "floor.r"], ["⌈", "ceil.l"], ["⌉", "ceil.r"], ["⟨", "angle.l"],
    ["⟩", "angle.r"], ["‖", "bar.v.double"], ["ℵ", "aleph"], ["‰", "permille"], ["∎", "qed"],
  ].map((s) => [...s, "misc"]),
];

const SYMBOL_SECTIONS = [
  ["recent", "Ostatnie"],
  ["greek", "Greckie"],
  ["ops", "Operatory"],
  ["rel", "Relacje"],
  ["arr", "Strzałki"],
  ["sets", "Zbiory i logika"],
  ["misc", "Analiza i inne"],
];

const SHAPES = [
  { id: "seg", group: "Linie", name: "Odcinek", icon: '<path d="M4 18 20 6"/><circle cx="4" cy="18" r="1.4"/><circle cx="20" cy="6" r="1.4"/>', svg: '<path d="M60 170 260 50"/><circle cx="60" cy="170" r="4" class="pt"/><circle cx="260" cy="50" r="4" class="pt"/><text x="44" y="192">A</text><text x="266" y="44">B</text>', code: "#line(start: (0pt, 0pt), end: (4cm, 2.4cm), stroke: 1pt + ink)" },
  { id: "arrow", group: "Linie", name: "Strzałka / wektor", icon: '<path d="M4 18 19 7"/><path d="M13 6.5h6.5V13"/>', svg: '<path d="M60 170 252 56"/><path d="m226 52 28 2-12 26" class="nf"/><text x="150" y="98">v⃗</text>', code: '#cetz.canvas({ line((0,0), (4,2.4), mark: (end: ">")) })' },
  { id: "arc", group: "Linie", name: "Łuk", icon: '<path d="M5 18a9 9 0 0 1 14-10"/>', svg: '<path d="M80 170a110 110 0 0 1 170-90" class="nf"/>', code: "#cetz.canvas({ arc((0,0), start: 0deg, stop: 120deg, radius: 2) })" },
  { id: "rect", group: "Wielokąty", name: "Prostokąt", icon: '<rect x="3" y="6" width="18" height="12" rx="1"/>', svg: '<rect x="60" y="55" width="200" height="120" class="f"/><text x="152" y="194">a</text><text x="268" y="120">b</text>', code: "#rect(width: 5cm, height: 3cm, stroke: 1pt + ink, fill: tint)" },
  { id: "square", group: "Wielokąty", name: "Kwadrat", icon: '<rect x="5" y="5" width="14" height="14" rx="1"/>', svg: '<rect x="100" y="45" width="130" height="130" class="f"/><text x="160" y="194">a</text>', code: "#square(size: 3cm, stroke: 1pt + ink, fill: tint)" },
  { id: "tri", group: "Wielokąty", name: "Trójkąt", icon: '<path d="M12 4 21 19H3z"/>', svg: '<path d="M80 175 260 175 130 50z" class="f"/><text x="64" y="192">A</text><text x="266" y="192">B</text><text x="124" y="40">C</text><path d="M130 50v125" class="dash"/><text x="136" y="130">h</text>', code: "#polygon((0cm, 3cm), (4.5cm, 3cm), (1.25cm, 0cm), stroke: 1pt + ink, fill: tint)" },
  { id: "poly", group: "Wielokąty", name: "Wielokąt foremny", icon: '<path d="M12 3.5 20 9.3l-3 9.2H7L4 9.3z"/>', svg: '<path d="M160 40 236 95 207 185H113L84 95z" class="f"/>', code: "#polygon.regular(vertices: 5, size: 4cm, stroke: 1pt + ink, fill: tint)" },
  { id: "circle", group: "Krzywe", name: "Okrąg", icon: '<circle cx="12" cy="12" r="8"/>', svg: '<circle cx="160" cy="112" r="78" class="f"/><circle cx="160" cy="112" r="3" class="pt"/><path d="M160 112h78" class="dash"/><text x="192" y="104">r</text><text x="146" y="130">S</text>', code: "#circle(radius: 2cm, stroke: 1pt + ink, fill: tint)" },
  { id: "ellipse", group: "Krzywe", name: "Elipsa", icon: '<ellipse cx="12" cy="12" rx="9" ry="6"/>', svg: '<ellipse cx="160" cy="112" rx="110" ry="66" class="f"/><path d="M50 112h220M160 46v132" class="dash"/>', code: "#ellipse(width: 6cm, height: 3.6cm, stroke: 1pt + ink, fill: tint)" },
  { id: "angle", group: "Geometria", name: "Kąt", icon: '<path d="M4 19h16M4 19 15 6"/><path d="M10 19a6 6 0 0 0-2-4.5"/>', svg: '<path d="M70 180h210M70 180 220 50" class="nf"/><path d="M130 180a60 60 0 0 0-15-40" class="nf acc"/><text x="138" y="160" class="acc">α</text>', code: "#cetz.canvas({ import cetz.angle: angle; angle((0,0), (4,0), (3,2.6), label: $alpha$) })" },
  { id: "axes", group: "Geometria", name: "Układ współrzędnych", icon: '<path d="M4 20V4M4 20h16"/><path d="m2.5 6 1.5-2 1.5 2M18 18.5l2 1.5-2 1.5"/>', svg: '<path d="M40 112h250M160 200V24" class="nf"/><path d="m282 107 8 5-8 5M155 32l5-8 5 8" class="nf"/><path d="M100 109v6M220 109v6M157 52h6M157 172h6" class="nf"/><text x="280" y="132">x</text><text x="168" y="34">y</text><text x="146" y="130">0</text>', code: '#cetz.canvas({ import cetz.draw: *; line((-3,0),(3,0), mark: (end: ">")); line((0,-2),(0,2.5), mark: (end: ">")) })' },
  { id: "plot", group: "Geometria", name: "Wykres funkcji", icon: '<path d="M3 20V4M3 20h18"/><path d="M5 17c4 0 5-10 8-10s4 6 7 6"/>', svg: '<path d="M40 180h250M60 200V24" class="nf"/><path d="M60 170C110 168 120 40 170 40s70 100 110 100" class="nf acc"/><text x="210" y="60" class="acc">f(x) = x·e⁻ˣ</text>', code: "#cetz.canvas({ import cetz-plot: plot; plot.plot(size: (6,3), { plot.add(domain: (0, 5), x => x * calc.exp(-x)) }) })" },
];

/* Action catalogue: id → label, group, icon, default key. Keys drive the real keyboard handler. */
const ACTIONS = [
  // App
  { id: "palette", label: "Paleta poleceń", group: "Aplikacja", icon: "command", key: "Ctrl+Shift+P" },
  { id: "goto", label: "Przejdź do notatki", group: "Aplikacja", icon: "file", key: "Ctrl+P" },
  { id: "search", label: "Szukaj w notatkach", group: "Aplikacja", icon: "search", key: "Ctrl+Shift+F" },
  { id: "settings", label: "Ustawienia", group: "Aplikacja", icon: "settings", key: "Ctrl+," },
  { id: "shortcuts", label: "Skróty klawiszowe", group: "Aplikacja", icon: "keyboard", key: "Ctrl+/" },
  { id: "toggleSidebar", label: "Pokaż lub schowaj pasek boczny", group: "Aplikacja", icon: "panel", key: "Ctrl+Alt+B" },
  { id: "toggleTheme", label: "Przełącz motyw jasny / ciemny", group: "Aplikacja", icon: "moon", key: "" },
  { id: "home", label: "Pokaż stronę startową", group: "Aplikacja", icon: "home", key: "" },
  // File
  { id: "newNote", label: "Nowa notatka", group: "Plik", icon: "plus", key: "Ctrl+N" },
  { id: "openNote", label: "Otwórz notatkę…", group: "Plik", icon: "file", key: "Ctrl+O" },
  { id: "openFolder", label: "Otwórz folder…", group: "Plik", icon: "folder", key: "Ctrl+Shift+O" },
  { id: "save", label: "Zapisz", group: "Plik", icon: "check", key: "Ctrl+S" },
  { id: "exportPdf", label: "Eksportuj do PDF", group: "Plik", icon: "download", key: "Ctrl+Shift+E" },
  { id: "closeTab", label: "Zamknij kartę", group: "Karty", icon: "close", key: "Ctrl+W" },
  { id: "reopenTab", label: "Otwórz ponownie zamkniętą kartę", group: "Karty", icon: "undo", key: "Ctrl+Shift+W" },
  { id: "nextTab", label: "Następna karta", group: "Karty", icon: "chevronRight", key: "Ctrl+Tab" },
  { id: "prevTab", label: "Poprzednia karta", group: "Karty", icon: "chevronLeft", key: "Ctrl+Shift+Tab" },
  // View
  { id: "viewSource", label: "Widok: źródło", group: "Widok", icon: "code", key: "Ctrl+Alt+S" },
  { id: "viewSplit", label: "Widok: podział", group: "Widok", icon: "split", key: "Ctrl+Alt+D" },
  { id: "viewPage", label: "Widok: strona", group: "Widok", icon: "eye", key: "Ctrl+Alt+R" },
  { id: "problems", label: "Pokaż lub zwiń panel problemów", group: "Widok", icon: "warning", key: "Ctrl+J" },
  { id: "uiStyle", label: "Przełącz styl interfejsu: stały lub pływający", group: "Widok", icon: "palette" },
  // Formatting
  { id: "bold", label: "Pogrubienie", group: "Formatowanie znaków", icon: "bold", key: "Ctrl+B", typst: "*tekst*" },
  { id: "italic", label: "Kursywa", group: "Formatowanie znaków", icon: "italic", key: "Ctrl+I", typst: "_tekst_" },
  { id: "underline", label: "Podkreślenie", group: "Formatowanie znaków", icon: "underline", key: "Ctrl+U", typst: "#underline[…]" },
  { id: "strike", label: "Przekreślenie", group: "Formatowanie znaków", icon: "strike", key: "Ctrl+Shift+X", typst: "#strike[…]" },
  { id: "super", label: "Indeks górny", group: "Formatowanie znaków", icon: "superscript", key: "Ctrl+.", typst: "#super[…]" },
  { id: "sub", label: "Indeks dolny", group: "Formatowanie znaków", icon: "subscript", key: "Ctrl+,", typst: "#sub[…]" },
  { id: "code", label: "Kod w linii", group: "Formatowanie znaków", icon: "code", key: "Ctrl+E", typst: "`kod`" },
  { id: "highlight", label: "Zakreślenie", group: "Formatowanie znaków", icon: "highlight", key: "Ctrl+Shift+H", typst: "#highlight[…]" },
  { id: "color", label: "Kolor tekstu…", group: "Formatowanie znaków", icon: "textColor", key: "Ctrl+Shift+C", typst: "#text(fill: …)" },
  { id: "clear", label: "Wyczyść formatowanie", group: "Formatowanie znaków", icon: "eraser", key: "Ctrl+\\" },
  { id: "undo", label: "Cofnij", group: "Edycja", icon: "undo", key: "Ctrl+Z" },
  { id: "redo", label: "Ponów", group: "Edycja", icon: "redo", key: "Ctrl+Y" },
  // Paragraph
  { id: "h0", label: "Zwykły akapit", group: "Akapity i nagłówki", icon: "pilcrow", key: "Ctrl+Alt+0" },
  { id: "h1", label: "Nagłówek 1", group: "Akapity i nagłówki", icon: "heading", key: "Ctrl+Alt+1", typst: "= " },
  { id: "h2", label: "Nagłówek 2", group: "Akapity i nagłówki", icon: "heading", key: "Ctrl+Alt+2", typst: "== " },
  { id: "h3", label: "Nagłówek 3", group: "Akapity i nagłówki", icon: "heading", key: "Ctrl+Alt+3", typst: "=== " },
  { id: "bullet", label: "Lista punktowana", group: "Akapity i nagłówki", icon: "bullets", key: "Ctrl+Shift+8", typst: "- " },
  { id: "numbered", label: "Lista numerowana", group: "Akapity i nagłówki", icon: "numbers", key: "Ctrl+Shift+7", typst: "+ " },
  { id: "term", label: "Lista terminów", group: "Akapity i nagłówki", icon: "terms", key: "", typst: "/ Termin: opis" },
  { id: "quote", label: "Cytat", group: "Akapity i nagłówki", icon: "quote", key: "Ctrl+Shift+Q", typst: "#quote[…]" },
  { id: "outdent", label: "Zmniejsz wcięcie", group: "Akapity i nagłówki", icon: "outdent", key: "" },
  { id: "indent", label: "Zwiększ wcięcie", group: "Akapity i nagłówki", icon: "indent", key: "" },
  // Insert
  { id: "inlineMath", label: "Wzór w linii", group: "Wstawianie", icon: "math", key: "Ctrl+M", typst: "$x^2$" },
  { id: "blockMath", label: "Wzór blokowy", group: "Wstawianie", icon: "mathBlock", key: "Ctrl+Shift+M", typst: "$ … $" },
  { id: "link", label: "Odnośnik…", group: "Wstawianie", icon: "link", key: "Ctrl+K", typst: "#link(…)" },
  { id: "footnote", label: "Przypis", group: "Wstawianie", icon: "footnote", key: "Ctrl+Alt+F", typst: "#footnote[…]" },
  { id: "symbol", label: "Symbol…", group: "Wstawianie", icon: "omega", key: "Ctrl+Shift+S" },
  { id: "table", label: "Tabelę…", group: "Wstawianie", icon: "table", key: "Ctrl+Shift+T", typst: "#table(…)" },
  { id: "codeBlock", label: "Blok kodu", group: "Wstawianie", icon: "codeBlock", key: "Ctrl+Shift+K", typst: "```" },
  { id: "image", label: "Obraz z dysku…", group: "Wstawianie", icon: "image", key: "", typst: "#image(…)" },
  { id: "shape", label: "Kształt geometryczny…", group: "Wstawianie", icon: "shape", key: "Ctrl+Shift+G" },
  { id: "reference", label: "Odsyłacz do etykiety", group: "Wstawianie", icon: "at", key: "", typst: "@etykieta" },
  { id: "date", label: "Dzisiejszą datę", group: "Wstawianie", icon: "clock", key: "" },
  { id: "pagebreak", label: "Podział strony", group: "Wstawianie", icon: "pagebreak", key: "", typst: "#pagebreak()" },
  { id: "outline", label: "Spis treści", group: "Wstawianie", icon: "bullets", key: "", typst: "#outline()" },
  // Demo
  { id: "simConflict", label: "Symuluj zmianę pliku na dysku", group: "Prototyp", icon: "warning", key: "" },
  { id: "simSaveFail", label: "Symuluj błąd zapisu", group: "Prototyp", icon: "warning", key: "" },
  { id: "resetProto", label: "Przywróć prototyp do stanu początkowego", group: "Prototyp", icon: "undo", key: "" },
];

const BLOCKS = [
  { head: "Matematyka" },
  { id: "definition", name: "Definicja", tag: "blue", label: "Definicja" },
  { id: "theorem", name: "Twierdzenie", tag: "violet", label: "Twierdzenie" },
  { id: "lemma", name: "Lemat / Wniosek", tag: "violet", label: "Lemat" },
  { id: "proof", name: "Dowód", tag: "gray", label: "Dowód" },
  { id: "example", name: "Przykład", tag: "green", label: "Przykład" },
  { head: "Notatki" },
  { id: "note", name: "Uwaga / Na egzamin", tag: "amber", label: "Uwaga" },
  { id: "exercise", name: "Zadanie z rozwiązaniem", tag: "teal", label: "Zadanie" },
  { id: "pagebreak", name: "Podział strony", plain: true },
];

const COLORS = [
  { id: "", name: "Domyślny", fg: "var(--color-text)", bg: "transparent", typst: "" },
  { id: "red", name: "Czerwony", fg: "var(--tag-red-fg)", bg: "var(--tag-red-bg)", typst: "red" },
  { id: "amber", name: "Pomarańczowy", fg: "var(--tag-amber-fg)", bg: "var(--tag-amber-bg)", typst: "orange" },
  { id: "green", name: "Zielony", fg: "var(--tag-green-fg)", bg: "var(--tag-green-bg)", typst: "green" },
  { id: "teal", name: "Morski", fg: "var(--tag-teal-fg)", bg: "var(--tag-teal-bg)", typst: "teal" },
  { id: "blue", name: "Niebieski", fg: "var(--tag-blue-fg)", bg: "var(--tag-blue-bg)", typst: "blue" },
  { id: "violet", name: "Fioletowy", fg: "var(--tag-violet-fg)", bg: "var(--tag-violet-bg)", typst: "purple" },
];
