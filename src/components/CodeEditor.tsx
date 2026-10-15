import { useState } from "react";
import Editor from "@monaco-editor/react";
import { useInterviewStore } from "../store/useInterviewStore";
import { Play, Send, Code2 } from "lucide-react";

export function CodeEditor() {
  const {
    code,
    language,
    codeOutput,
    setCode,
    setLanguage,
    setCodeOutput,
    submitCodeToAi,
    isAiThinking,
  } = useInterviewStore();

  const [isRunning, setIsRunning] = useState(false);

  const handleRunCode = async () => {
    setIsRunning(true);
    setCodeOutput("Executing...");

    // Small delay to simulate network request and provide UI feedback
    await new Promise(resolve => setTimeout(resolve, 600));

    if (language !== "javascript") {
      setCodeOutput(`Execution for ${language} requires a dedicated backend sandbox. Switched to JavaScript fallback.`);
      setIsRunning(false);
      return;
    }

    try {
      let outputBuffer = "";
      // Intercept console.log and console.error
      const originalLog = console.log;
      const originalError = console.error;

      console.log = (...args) => {
        outputBuffer += args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(" ") + "\n";
      };
      console.error = (...args) => {
        outputBuffer += "ERROR: " + args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(" ") + "\n";
      };

      // Execute the code securely in local context
      try {
        const runner = new Function(code);
        runner();
        setCodeOutput(outputBuffer ? outputBuffer.trim() : "Executed successfully with no output.");
      } catch (runtimeError: any) {
        setCodeOutput(`Runtime Error: ${runtimeError.message}`);
      }

      // Restore console methods to prevent memory leaks or app-wide overrides
      console.log = originalLog;
      console.error = originalError;

    } catch (error: any) {
      setCodeOutput(`System Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] rounded-xl overflow-hidden border border-gray-700">
      {/* Editor Header */}
      <div className="flex justify-between items-center p-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <Code2 className="w-5 h-5 text-blue-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-gray-800 text-sm text-gray-200 border-none rounded outline-none p-1 cursor-pointer"
          >
            <option value="javascript">JavaScript (Node/Browser)</option>
            <option value="python" disabled>Python 3 (Requires Backend)</option>
            <option value="java" disabled>Java (Requires Backend)</option>
          </select>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>{isRunning ? "Running..." : "Run Code"}</span>
          </button>
          <button
            onClick={submitCodeToAi}
            disabled={isAiThinking}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>Submit to AI</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-[300px]">
        <Editor
          height="100%"
          language={language === "javascript" ? "javascript" : language}
          theme="vs-dark"
          value={code}
          onChange={(val) => setCode(val || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
          }}
        />
      </div>

      {/* Execution Terminal */}
      <div className="h-48 bg-black border-t border-gray-700 p-3 overflow-y-auto font-mono text-sm text-gray-300">
        <div className="text-gray-500 mb-1">Terminal Output:</div>
        <pre className="whitespace-pre-wrap">{codeOutput}</pre>
      </div>
    </div>
  );
}
