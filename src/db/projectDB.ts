import Dexie, { Table } from 'dexie';
import { ProjectData } from '../types';

export interface SavedProject {
  id?: number;
  name: string;
  data: ProjectData;
  timestamp: number;
}

export class ProjectDatabase extends Dexie {
  projects!: Table<SavedProject>;

  constructor() {
    super('ProjectGrapherDB');
    this.version(1).stores({
      projects: '++id, name, timestamp'
    });
  }
}

export const db = new ProjectDatabase();
