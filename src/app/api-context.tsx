"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface ApiContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  baseUrl: string;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState(localStorage.getItem("apiKey") || "");
  // TODO: Configure this properly based on environment
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://cloud-router:3000/api/v1";

  useEffect(() => {
    localStorage.setItem("apiKey", apiKey);
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
      throw new Error(`API Error: ${response.status} ${error}`);
    }

    return response.json();
  };
}
