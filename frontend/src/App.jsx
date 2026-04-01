import { Link, Route, Routes } from "react-router-dom";
import MarketPage from "./pages/MarketPage";
import MintPage from "./pages/MintPage";
import ExecutePage from "./pages/ExecutePage";
import MyPage from "./pages/MyPage";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>PromptNFT</h1>
        <nav>
          <Link to="/">마켓</Link>
          <Link to="/mint">민팅</Link>
          <Link to="/my">내 NFT</Link>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<MarketPage />} />
          <Route path="/mint" element={<MintPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="/execute/:tokenId" element={<ExecutePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;