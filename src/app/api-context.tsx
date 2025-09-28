"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

interface ApiContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  baseUrl: string;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState("");
  // TODO: Configure this properly based on environment
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://cloud-router:3000/api/v1";

  // Load from localStorage on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("apiKey");
      if (savedKey) {
        setApiKey(savedKey);
      }
    }
  }, []);

  // Persist to localStorage when key changes (client only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("apiKey", apiKey);
    }
  }, [apiKey]);

  return (
    <ApiContext.Provider value={{ apiKey, setApiKey, baseUrl }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error("useApi must be used within an ApiProvider");
  }
  return context;
}

export function useApiRequest() {
  const { apiKey, baseUrl } = useApi();

  return async (endpoint: string, options: RequestInit = {}): Promise<any> => {
    const headers = {
      "Content-Type": "application/json",
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      ...options.headers,
    };

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 401) {
        console.log("API key is invalid");
        return null;
      } else {
        console.error(`API Error: ${response.status} ${error}`);
        return null;
      }
    }

    return await response.json();
  };
}
