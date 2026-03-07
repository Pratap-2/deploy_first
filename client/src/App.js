import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Interview from "./pages/Interview";
import Analysis from "./pages/Analysis";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/interview/:problemId" element={<Interview />} />
        <Route path="/analysis" element={<Analysis />} />
      </Routes>
    </Router>
  );
};

export default App;
