# Route Forest

「情報通信路」を題材にしたインタラクティブ作品の実装です。参加者がWebサイトを選ぶと、会場のUbuntuサーバーからそのサイト方向へtracerouteを行い、匿名化した経路を大型画面の鳥・木・霧・紙飛行機として描きます。

- Cloudflare Tunnelから渡された接続元IPは匿名化した連続操作防止にだけ使う
- 入力URLから正規化した公開ドメイン名だけを受け付ける
- DNS解決した公開IPv4を一度固定し、IP直接指定と非グローバルIPを拒否する
- 対象サイトへHTTPアクセスせず、tracerouteだけを実行する
- tracerouteを有限時間・有限並列・固定引数で実行する
- 生IPをDB、結果、ログへ保存しない
- 応答しない連続hopを一つのUnknownSegmentへ正規化する
- 観測不能とシステム障害を分離する
- 大型画面へ匿名化済み結果をSSEで同期する

## 信頼境界

HTTPサーバーは既定で `127.0.0.1` にだけ待ち受けます。Cloudflare Tunnelのローカル転送先として使用し、公開ポートや展示LANへ直接公開しません。

計測APIは、loopback接続上で受け取った単一の `CF-Connecting-IP` だけを連続操作防止の識別に使います。計測先は本文の `website` からドメイン名だけを抽出し、サーバー側でDNS解決します。IPアドレス、任意ポート、認証情報、ローカル名、非公開アドレスは拒否します。

CloudflareのPseudo IPv4は「Overwrite Headers」を使用せず、Workerや別CDNをこの入口の前後へ追加しないことを前提にしています。

## API

- `GET /health` — プロセスのreadiness
- `POST /api/measurements` — 同意済みの計測をキューへ登録
- `GET /api/measurements/{id}` — 匿名化済み結果の取得
- `GET /api/display/events` — 大型画面向けの匿名化SSE
- `GET /display` — 大型展示画面
- `GET /display?demo=1` — 合成経路による展示デモ

計測登録本文には `website`、同意の真偽、同意文の版だけを含めます。

## ローカル確認

依存パッケージはありません。Node.js 22以上で自動テストを実行できます。

実サーバーの起動には、32文字以上の `ROUTE_HMAC_SECRET`、公開URLの `PUBLIC_ORIGIN`、Ubuntuの `traceroute` が必要です。秘密値はソース、ログ、DBへ保存しません。

## 現段階の非対象

- 会場外アクセスの制限
- 動的QRまたはワンタイム会場コード
- 永続DBと展示状態
- スマートフォンからの紙飛行機操作
- CDN PoPの確定表示
- TCP方式へのフォールバック

## 検証サーバー

検証サーバーでは、アプリをsystemdシステムサービス、Cloudflare Tunnelをsystemdユーザーサービスとして分離します。

- `route-forest.service` — `m-osuke`として`127.0.0.1:8080`で待ち受ける検証API。`NoNewPrivileges=true`を維持し、`CAP_NET_RAW`だけをsystemdから受け取る
- `route-forest-tunnel.service` — Tunnelトークンファイルを読み込むcloudflared

秘密値はリポジトリへ保存せず、`~/.config/route-forest/`内の権限`600`のファイルから読み込みます。

tracerouteはICMPを優先し、応答アドレスを一つも観測できない場合だけUDPへフォールバックします。

## 描画性能検証

`/display?performance=1`で、実際のtracerouteやSSEへ依存しない描画負荷モードを開始します。通常の`/display`には性能UIや仮データを表示しません。

初期負荷は木220本、鳥8羽、局所的な霧12区間、紙飛行機32機です。次のクエリパラメータで個別に変更できます。

- `trees` — 20〜800
- `birds` — 1〜24
- `fogs` — 0〜30
- `planes` — 0〜120

1920×1080で平均50 FPS以上、フレーム時間の95パーセンタイルが25ms以下を暫定基準とします。ブラウザが非表示のときは`requestAnimationFrame`が省電力制限を受けるため判定せず、画面を可視状態にしてから3秒間のウォームアップ後に計測します。

## 風と操作感の検証

`/control-lab`は、実際の経路計測やSSEから分離した紙飛行機の操作感検証ページです。

- 複数オクターブの値ノイズをスカラー場とし、その回転から発散の少ない二次元風場を生成する
- タッチドラッグを初期操作方式とし、キーボードの矢印キーとWASDでも検証できる
- 風、来場者入力、慣性を独立して調整する
- 初期値は風26、操作80、慣性1.15
- 最大入力時の操作力が最大風力の2.4倍以上になることを暫定基準とする
- 「静かな風」「展示初期値」「強い風」の3条件を比較できる

風場の計算は`public/flow-field.js`に分離し、将来の大型展示レンダラーからも同じ契約で利用できるようにしています。

## 共通データ契約

`public/experience-contract.js`が、システム本体から演出ディレクターへ渡す
`RouteObservation`と、演出ディレクターからレンダラーへ渡す
`BirdSequence`の境界です。大型展示はtracerouteの出力を直接解釈せず、
匿名化済みの観測を検証してから、木と霧の順序を持つ演出命令へ変換します。

## シミュレーター

`/simulator`では、実際のtracerouteに依存せず16種類の経路・負荷・接続状態を
生成できます。各シナリオは`public/simulator-scenarios.js`にあり、自動テストと
展示プレビュー`/display?simulation={scenario}`が同じデータを利用します。

## 単純図形による演出

大型展示は、鳥が各ノードへ種を落として木を育て、未観測区間では霧へ隠れ、
まれに羽を残します。経路の終端では手紙が紙飛行機へ折り変わり、観測できた
区間だけが短時間発光します。形状補間と発光対象の判定は
`public/exhibition-effects.js`へ分離しています。

## 視覚標本帳

`/style-guide`で、展示が実際に使用する色・書体・形・時間・素材契約を確認できます。
実行可能な正本は`public/visual-style.js`、制作判断の文書は
`docs/visual-style-guide.md`と`docs/asset-contract.md`です。

## Art Lab

`/art-lab`では、鳥と木の「折り痕」「筆脈」「通信層」の3方向を、同じ飛行・
成長・霧・密度条件で比較できます。選択されるまでは本番展示へ反映しません。
