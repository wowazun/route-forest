# Route Forest asset-contract v1

素材を手続き図形からSVG、Sprite、Riveへ差し替えるときの契約。
実行可能な値は `public/visual-style.js` の `assetContract` を正本とする。

## 共通条件

- 座標原点は素材の意味上のアンカーに置く。
- 正面方向は原則として `+x` とする。
- 表示色は素材へ焼き込まず、実行時のパレットから受け取れるようにする。
- 個人情報、IPアドレス、ホスト名を画像やファイル名へ含めない。
- 透明背景を維持する。
- 低解像度表示でも輪郭が0.8px未満にならない。
- `prefers-reduced-motion` で静止状態を提示できる。
- 素材読み込み失敗時は現在の手続き図形へ戻せる。

## 素材別アンカー

| Asset | Anchor | Forward | Nominal px | Required states |
|---|---|---|---:|---|
| Bird | body-center | +x | 48×22 | glide, flap |
| Tree | trunk-ground | -y | 72×116 | seedling, grown |
| Seed | center | +y | 7×11 | fall |
| Feather | shaft-center | +y | 12×20 | drift |
| Letter | center | +x | 20×14 | closed, folding |
| Plane | fold-center | +x | 29×16 | release, flight |
| Fog | center | none | 144×84 | appear, hold, fade |

## Riveを採用する場合

- State Machineの入力名をコード側の状態名と一致させる。
- 時間を素材内部だけで決めず、外部から進捗0..1を与えられるようにする。
- LetterとPlaneを別ファイルに分けず、折り変化を一つの状態遷移にする。
- フォールバック用の静止SVGまたは手続き図形を残す。

## Spriteを採用する場合

- 1x/2xのアトラスを用意する。
- 余白を含むフレーム寸法とアンカーを全フレームで固定する。
- alpha premultiplicationの設定を記録する。
- 同時表示120機で性能基準を満たす。

## 受け入れ条件

1. 現行素材と同じアンカーで位置が跳ねない。
2. 同じ速度ベクトルで向きが一致する。
3. 色の役割を変更しない。
4. 霧区間を実在経路に見せない。
5. 1920×1080で50 FPS以上、p95フレーム時間25ms以下。
6. 読み込み失敗時に展示全体が停止しない。
