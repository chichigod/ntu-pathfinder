# NTU PathFinder — 台大學生個人化學習地圖

依據《第 G 組 Milestone 1》規格實作的 MVP：使用者輸入想學的領域或職業，系統依臺大實際課程提供建議學習路徑、先修關係視覺化、課程資訊整合、個人化跨學期排課（衝堂 / 學分 / 先修 / 負擔檢查）、計畫儲存，以及學習路徑投稿與評價。

## 技術架構

| 項目 | 技術 | 位置 |
| --- | --- | --- |
| 前端 | React 19 + TypeScript + Vite、React Router | `frontend/` |
| 學習地圖 | React Flow (`@xyflow/react`) | `frontend/src/components/LearningMap.tsx` |
| 後端 | Python 3.12 + FastAPI | `backend/app/` |
| 資料庫 | SQLAlchemy；預設 SQLite，設定 `DATABASE_URL` 即可改用 PostgreSQL | `backend/app/database.py` |
| 課程 / 路徑資料 | 人工整理的種子資料（含來源與更新日期） | `backend/app/seed_data.py` |
| 推薦 / 檢查 / 排課邏輯 | 關鍵字對應路徑、衝堂與先修檢查、貪婪式排課 | `backend/app/services.py` |

## 快速啟動

```powershell
# 1. 後端（第一次需建立虛擬環境並安裝套件）
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
# API 文件：http://localhost:8000/docs

# 2. 前端（另開一個終端機）
cd frontend
npm install
npm run dev
# 網站：http://localhost:5173
```

或在專案根目錄執行 `powershell -ExecutionPolicy Bypass -File .\start.ps1` 一次開啟兩者（需先完成上面的安裝步驟）。

後端測試：`cd backend; .\.venv\Scripts\python -m tests.test_api`

## 功能對照（文件 4.2 / 5.4）

| 文件功能 | 實作頁面 | 說明 |
| --- | --- | --- |
| 功能一 學習路徑推薦 | 首頁 `/`、`/paths/:id` | 輸入目標（如「我想成為類比 IC 設計工程師」）→ 關鍵字對應到 5 條人工確認路徑；每條路徑拆成「能力 → 課程 → 推薦理由」，並顯示資料來源與更新日期 |
| 先修關係視覺化 | `/paths/:id` 學習地圖分頁 | React Flow 互動圖：實線 = 硬性先修、虛線 = 建議先修；節點顏色顯示已修 / 已排入 / 可修 / 需先修 |
| 路徑比較 | `/compare?a=&b=` | 比較兩條路徑的共同課程與差異課程（例：數位 IC vs 類比 IC） |
| 功能二 課程資訊整合 | `/courses`、`/courses/:id` | 課名、課號、學分、教師、時間、先修、預估負擔、學習資源、學生評價、修完可往哪走 |
| 功能三 個人化排課 | `/planner` | 勾選已修課程、多學期規劃、週課表、即時檢查衝堂 / 學分上下限 / 先修條件 / 開課學期 / 課業負擔；「依路徑自動排課」產生建議 |
| 儲存個人學習計畫 | `/planner` | 自動保存在瀏覽器，輸入暱稱後可儲存 / 載入 / 刪除伺服器上的多份計畫 |
| 功能四 路徑投稿與評價 | `/community`、`/admin` | 投稿 → 管理員審核（預設密碼 `ntu-admin`）→ 公開；按讚、收藏、留言建議；課程頁可新增評價 |

## 目前資料範圍

第一階段僅收錄電機、資工相關 37 門課程與 5 條職涯路徑（類比 IC、數位 IC、射頻 IC、軟體工程師、AI 工程師）。課號、授課教師與時段為團隊人工整理的示意資料，選課前請以[臺大課程網](https://course.ntu.edu.tw)為準。新增課程或路徑只需編輯 `backend/app/seed_data.py`，重新啟動後端即會更新。

## 主要 API

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| GET | `/api/paths?q=` | 依目標關鍵字搜尋路徑 |
| GET | `/api/paths/{id}` | 路徑詳情（能力、階段、課程、先修邊） |
| GET | `/api/paths/{a}/compare/{b}` | 路徑比較 |
| GET | `/api/courses?q=&department=&level=&term=` | 課程搜尋 |
| GET / POST | `/api/courses/{id}`、`/api/courses/{id}/reviews` | 課程詳情、新增評價 |
| POST | `/api/plans/check` | 衝堂 / 學分 / 先修 / 負擔檢查 |
| POST | `/api/plans/suggest` | 依路徑與已修課程自動排課 |
| GET / POST / PUT / DELETE | `/api/plans` | 儲存個人計畫 |
| GET / POST | `/api/submissions`、`/{id}/like`、`/{id}/comments`、`/{id}/review` | 投稿、按讚、留言、審核 |
| GET / POST | `/api/favorites` | 收藏 |

## 未來擴充（文件 5.2）

全系所課程、雙主修 / 輔系資格判定、串接正式選課系統、LLM + RAG 輔助推薦（目前以人工對應保證課程真實存在）、OR-Tools 最佳化排課。
