import { Express } from "express";
import socialNetworkRouter from "./social-network";
import socialDirectMessagesRouter from "./social-direct-messages";

/**
 * Configura las rutas de la red social
 */
export function setupSocialNetworkRoutes(app: Express): void {
  app.use("/api/social", socialNetworkRouter);
  app.use("/api/social/dm", socialDirectMessagesRouter);
}