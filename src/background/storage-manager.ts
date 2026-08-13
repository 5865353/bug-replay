/**
 * src/background/storage-manager.ts — IndexedDB 存储管理
 *
 * 封装 IndexedDB 操作，管理录制会话的持久化存储
 */

import type { RecordingSession } from '@shared/types';
import { DB_NAME, DB_VERSION, STORE_SESSIONS } from '@shared/constants';

export class StorageManager {
    private db: IDBDatabase | null = null;

    /**
     * 获取 IndexedDB 实例（懒初始化）
     */
    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                    db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
            };
        });
    }

    /**
     * 保存录制会话
     */
    async saveSession(session: RecordingSession): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_SESSIONS, 'readwrite');
            const store = tx.objectStore(STORE_SESSIONS);
            store.put(session);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * 获取单个录制会话
     */
    async getSession(id: string): Promise<RecordingSession | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_SESSIONS, 'readonly');
            const store = tx.objectStore(STORE_SESSIONS);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取所有录制会话
     */
    async getAllSessions(): Promise<RecordingSession[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_SESSIONS, 'readonly');
            const store = tx.objectStore(STORE_SESSIONS);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result ?? []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 删除录制会话
     */
    async deleteSession(id: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_SESSIONS, 'readwrite');
            const store = tx.objectStore(STORE_SESSIONS);
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * 清空所有录制会话
     */
    async clearAll(): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_SESSIONS, 'readwrite');
            const store = tx.objectStore(STORE_SESSIONS);
            store.clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

/** 全局共享的存储管理器实例 */
export const storageManager = new StorageManager();
