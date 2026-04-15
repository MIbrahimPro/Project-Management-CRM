import { config } from "dotenv";
config();

import { Server } from "@hocuspocus/server";
import { prisma } from "./src/lib/prisma";
import { verifyAccessToken } from "./src/lib/tokens";
import * as Y from "yjs";

const server = Server.configure({
  port: parseInt(process.env.HOCUSPOCUS_PORT ?? "3001", 10),

  async onAuthenticate({ token, documentName }) {
    const payload = verifyAccessToken(token);
    if (!payload) throw new Error("Unauthorized");

    const docId = documentName.split("-doc-")[1];
    if (!docId) throw new Error("Invalid document name");

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, access: true, ownerId: true, projectId: true },
    });
    if (!doc) throw new Error("Document not found");

    // PRIVATE docs: only the owner can access
    if (doc.access === "PRIVATE" && doc.ownerId !== payload.userId) {
      throw new Error("Forbidden");
    }

    return { userId: payload.userId, role: payload.role };
  },

  async onLoadDocument({ documentName, document }) {
    const docId = documentName.split("-doc-")[1];
    if (!docId) return;

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { content: true },
    });

    if (doc?.content) {
      try {
        const update = Buffer.from(doc.content, "base64");
        Y.applyUpdate(document, update);
      } catch (err) {
        console.error("[Hocuspocus] Failed to load document state:", err);
      }
    }
  },

  async onStoreDocument({ documentName, document }) {
    const docId = documentName.split("-doc-")[1];
    if (!docId) return;

    try {
      const state = Y.encodeStateAsUpdate(document);
      await prisma.document.update({
        where: { id: docId },
        data: { content: Buffer.from(state).toString("base64") },
      });
    } catch (err) {
      console.error("[Hocuspocus] Failed to store document state:", err);
    }
  },
});

server.listen().then(() => {
  console.log(`[Hocuspocus] Running on port ${process.env.HOCUSPOCUS_PORT ?? 3001}`);
});
