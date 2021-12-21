import os from "os";
import path from "path";
import fs from "fs";
import util from "util";
import { v4 as uuidv4 } from "uuid";

const pathExists = util.promisify(fs.exists);

function getRapiderPath() {
  return path.join(os.homedir(), ".rapider");
}

function getStorePath(name: string) {
  return path.join(getRapiderPath(), name);
}

function getStoreDataPath(name: string) {
  return path.join(getStorePath(name), "data.json");
}

class RapiderStore {
  private path: string;
  private dataPath: string;
  private cache: any;

  constructor(name: string) {
    this.path = getStorePath(name);
    this.dataPath = getStoreDataPath(name);
  }

  getPath() {
    return this.path;
  }

  getDataPath() {
    return this.dataPath;
  }

  async load() {
    if (this.cache) {
      return this.cache;
    }
    const buffer = await util.promisify(fs.readFile)(this.dataPath);
    const data = await JSON.parse(buffer.toString());
    return data;
  }

  async get<T>(
    field: string,
    _default: T | undefined = undefined
  ): Promise<T | undefined> {
    const nestedFields = field.split(".");
    let data = await this.load();
    for (const nestedField of nestedFields) {
      data = data[nestedField];
      if (data === undefined) {
        return _default;
      }
    }
    if (data === undefined) {
      return _default;
    }
    return data;
  }

  async getKeyed<T>(container: string): Promise<(T | { key: string })[]> {
    const itemsObj = (await this.get(container, {})) as Record<string, T>;
    const items = Object.entries(itemsObj).map(([key, value]) => ({
      ...value,
      key,
    }));
    return items;
  }

  async set<T>(field: string, data: T) {
    const nestedFields = field.split(".");
    const thisField = nestedFields.slice(-1)[0];
    const parent = field.split(".").slice(0, -1).join(".");

    type ParentObject = { [thisField: string]: T };

    if (parent == "") {
      this.invalidateCache();
      await util.promisify(fs.writeFile)(
        this.dataPath,
        JSON.stringify({
          ...(await this.load()),
          [field]: data,
        })
      );
    } else {
      await this.update<ParentObject>(parent, (parentData) => {
        if (parentData?.constructor === Object) {
          return {
            ...parentData,
            [thisField]: data,
          };
        } else {
          return { [thisField]: data };
        }
      });
    }
  }
  async add<T>(
    container: string,
    data: T,
    options: { key: "linear" | "uuid" } = { key: "linear" }
  ) {
    let key;
    if (options.key === "uuid") {
      key = uuidv4();
    } else if (options.key === "linear") {
      // A linearly increasing key.
      // If items have been deleted, key still increases uniquely.
      const lastKeyPath = `__rapider__.linear_keys.${container}.last_key`;
      const lastKey = (await this.get(lastKeyPath, 0)) as number;
      key = lastKey + 1;
      await this.set(lastKeyPath, key);
    }
    return this.set(`${container}.${key}`, data);
  }

  async update<T>(
    field: string,
    updater: (current: T | undefined) => T | Promise<T>
  ) {
    const existingData = await this.get<T>(field);
    await this.set(field, await updater(existingData));
  }

  async delete<T>(field: string): Promise<T> {
    const fieldParts = field.split(".");
    const parentField = fieldParts.slice(0, -1).join(".");
    const fieldToDelete = fieldParts.slice(-1)[0];

    let deletedData = undefined as unknown as T;

    type ParentObject = { [fieldToDelete: string]: T };

    await this.update<ParentObject>(parentField, (data) => {
      const { [fieldToDelete]: dataToDelete, ...dataToKeep } = (data ||
        {}) as ParentObject;
      deletedData = dataToDelete;
      return dataToKeep;
    });

    return deletedData;
  }

  async addElement(field: string, items: any[]) {
    await this.update(field, (existingData) => {
      if (Array.isArray(existingData)) {
        return [...existingData, ...items];
      } else {
        return items;
      }
    });
  }

  async updateElement<T>(
    field: string,
    finder: (el: T) => Boolean,
    updater: (current: any) => any | Promise<any>
  ) {
    return this.update<T[]>(field, async (current) => {
      const newElements = await Promise.all(
        (current || []).map(async (element: T) => {
          if (finder(element) === true) {
            return await updater(element);
          } else {
            return element;
          }
        })
      );
      return newElements;
    });
  }

  async deleteElement<T>(field: string, finder: (el: T) => Boolean) {
    return this.update<T[]>(field, async (current) => {
      const newElements = [];
      for (const el of current || []) {
        if (!finder(el)) {
          newElements.push(el);
        }
      }
      return newElements;
    });
  }

  invalidateCache() {
    this.cache = undefined;
  }

  async register() {
    if (fs.existsSync(getRapiderPath()) === false) {
      await util.promisify(fs.mkdir)(getRapiderPath());
    }
    if (fs.existsSync(this.path) === false) {
      await util.promisify(fs.mkdir)(this.path);
    }
    if (fs.existsSync(this.dataPath) === false) {
      await util.promisify(fs.writeFile)(this.dataPath, JSON.stringify({}));
    }
  }
}

export const create = (name: string) => {
  return new RapiderStore(name);
};
