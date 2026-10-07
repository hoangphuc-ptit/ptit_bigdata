import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import "./styles.css";
import Overview from "./pages/Overview";
import GroupBy from "./pages/GroupBy";
import Benchmarks from "./pages/Benchmarks";
import KMeansPage from "./pages/KMeansPage";
import KnnPage from "./pages/KnnPage";
import { RunProvider } from "./run";

function App() {
  return (
    <RunProvider>
      <header>
        <strong>PTIT Big Data · Bài 21 Group By Aggregation</strong>
        <nav>
          <NavLink to="/" end>Tổng quan</NavLink>
          <NavLink to="/groupby">Group By</NavLink>
          <NavLink to="/benchmarks">MapReduce vs Spark</NavLink>
          <NavLink to="/ml/kmeans">K-Means</NavLink>
          <NavLink to="/ml/knn">KNN</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/groupby" element={<GroupBy />} />
          <Route path="/benchmarks" element={<Benchmarks />} />
          <Route path="/ml/kmeans" element={<KMeansPage />} />
          <Route path="/ml/knn" element={<KnnPage />} />
        </Routes>
      </main>
    </RunProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
