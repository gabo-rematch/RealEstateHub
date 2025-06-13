import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {
  // This is a frontend-only application that uses Supabase directly
  // All property data queries and webhook submissions are handled on the frontend
  // The backend is kept minimal as per the requirements
  
  const httpServer = createServer(app);
  return httpServer;
}
