# レシピBox

## デプロイ (Vercel)
1. このフォルダを GitHub に push → vercel.com で Import (設定変更なし)
   または `npx vercel --prod`
2. 発行されたURLをiPhoneのChromeで開く
3. 共有ショートカット: 「ショートカット」アプリで
   `https://<your-app>.vercel.app/?url=` + (共有された URL) を「URLを開く」にする

## 構成
- public/index.html … アプリ本体
- api/recipe.js … URL→タイトル・材料・手順 (schema.org/Recipe の JSON-LD を解析)
