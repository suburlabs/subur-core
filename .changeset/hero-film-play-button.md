---
"@suburlabs/core": patch
---

Hero: quan el navegador no deixa reproduir el film fins que hi ha un gest (Safari amb el mode de baix consum, al Mac i a l’iPhone), l’escenari passa a l’estat nou `ready` i un botó sobre la imatge el demana: «Haga clic y desplácese», o «Toque y desplácese» en una pantalla tàctil (dos textos nous de la interfície, `heroFilmPlay` i `heroFilmPlayTouch`). Al mòbil ocupa la franja del carril fins que el film arrenca. Fer scroll no és un gest: fins ara, el visitant només veia les fotos. Afegeix la migració `20261111_105420_hero_film_play` (dues columnes que admeten nul a `site_settings_locales`).
