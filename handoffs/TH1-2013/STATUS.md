# TH1-2013 status

Branch: `hteo1337/th1-2013-accept-youtube-music-radio-song-links-and-album-page-links` in `hteo1337/yoto`.
Done: radio song URLs with `v` classify/canonicalize as videos; bare RD lists remain rejected Mixes. Album browse URLs classify as playlists and pass through unchanged.
Album probe: `https://music.youtube.com/browse/MPREb_K8qWMWVqXGi` (Random Access Memories) resolved in live `yoto-app-1` via yt-dlp to `OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c`, then 13 video IDs. Read-only command; stack untouched.
Verification: `npm ci` exit 0. Required sequence: format 1 (pre-existing `.paseo-ops-rules.json` formatting), lint 0, typecheck:ci 0, test 1 (old route Mix fixture contradicted requested behavior; changed fixture to bare RD and reran tests: 26 files/281 tests pass), build 0, build:selfhost 0. Tests were rerun after fixture correction.
Next: rerun required sequence on final head, create draft PR, obtain PR-ready Sol review. PR must remain unmerged by worker.
Open questions: none.
