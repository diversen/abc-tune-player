# Sheet Interpreter

Sheet Interpreter is a browser-based player for ABC notation. It renders a tune as sheet music and highlights the notes during playback. You can change the instrument, adjust the tempo, transpose the tune, or loop it for practice.

## Try the player

[Open the GitHub Pages demo](https://diversen.github.io/abc-tune-player/) and choose a song from **Tune library**.

To run the player locally, start the server from the project directory. It uses only the Python standard library.

```sh
python3 main.py
```

Open [the local player](http://localhost:8765) and select a song from **Tune library**. The player reads the selected ABC file directly from [tunes/](tunes/). To add a song, save a UTF-8 `.abc` file there or in a subdirectory and reload the page. To hear an edit, select the song again after reloading.

You can also use **Open ABC file** or **Paste ABC notation**, including when you open [index.html](index.html) directly from disk. If a file contains several tunes, use the **Tune** selector to choose one. The renderer and audio samples are included for offline use.

## Bundled tunes on GitHub Pages

Edit the ABC files in [tunes/](tunes/) to change the music or lyrics. When adding, renaming, or removing a tune, update its option in the library selector in [index.html](index.html).
