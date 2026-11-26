# Sheet Interpreter

Sheet Interpreter is a browser-based player for ABC notation. It renders a tune as sheet music and highlights the notes during playback. You can change the instrument, adjust the tempo, transpose the tune, or loop it for practice.

## Try the player

Open [index.html](index.html) directly in your browser. The demo works offline using the bundled tune library, the abcjs renderer, and audio samples from [vendor/](vendor/). To host the same demo on GitHub Pages, publish the repository root.

Select a bundled tune from the **Tune library**, open a local file with **Open ABC file**, or enter ABC text under **Paste ABC notation**. If a file contains several tunes, use the **Tune** selector to choose one.

## Work with the tune library

When adding or editing tunes, run the local server from the project directory with Python 3.13 or later. It uses only the Python standard library.

```sh
python3 main.py
```

Open [the local player](http://localhost:8765). Save your tune as a UTF-8 `.abc` file in [tunes/](tunes/) or one of its subdirectories, then reload the page. The server reads the tune files on each page load.

To include your changes in the offline demo, rebuild its catalog from the project directory and commit the updated `tunes-library.js` alongside the tune files.

```sh
python3 update_tunes.py
```
