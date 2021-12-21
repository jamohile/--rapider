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

export async function register(name: string) {
  const store = {
    path: getStorePath(name),
    dataPath: getStoreDataPath(name),

    cache: undefined,
    invalidateCache: () => {
      store.cache = undefined;
    },

    load: async () => {
      if (store.cache) {
        return store.cache;
      }
      const buffer = await util.promisify(fs.readFile)(store.dataPath);
      const data = await JSON.parse(buffer.toString());
      return data;
    },
    get: async <T>(
      field: string,
      _default: T | undefined = undefined
    ): Promise<T | undefined> => {
      const nestedFields = field.split(".");
      let data = await store.load();
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
    },
    getKeyed: async <T>(
      container: string
    ): Promise<(T | { key: string })[]> => {
      const itemsObj = (await store.get(container, {})) as Record<string, T>;
      const items = Object.entries(itemsObj).map(([key, value]) => ({
        ...value,
        key,
      }));
      return items;
    },
    set: async (field: string, data: any) => {
      const nestedFields = field.split(".");
      const thisField = nestedFields.slice(-1)[0];
      const parent = field.split(".").slice(0, -1).join(".");

      if (parent == "") {
        store.invalidateCache();
        await util.promisify(fs.writeFile)(
          store.dataPath,
          JSON.stringify({
            ...(await store.load()),
            [field]: data,
          })
        );
      } else {
        await store.update(parent, (parentData) => {
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
    },
    add: async <T>(
      container: string,
      data: T,
      options: { key: "linear" | "uuid" } = { key: "linear" }
    ) => {
      let key;
      if (options.key === "uuid") {
        key = uuidv4();
      } else if (options.key === "linear") {
        // A linearly increasing key.
        // If items have been deleted, key still increases uniquely.
        const lastKeyPath = `__rapider__.linear_keys.${container}.last_key`;
        const lastKey = (await store.get(lastKeyPath, 0)) as number;
        key = lastKey + 1;
        await store.set(lastKeyPath, key);
      }
      return store.set(`${container}.${key}`, data);
    },
    update: async (
      field: string,
      updater: (current: any) => any | Promise<any>
    ) => {
      const existingData = await store.get(field);
      await store.set(field, await updater(existingData));
    },
    append: async (field: string, items: any[]) => {
      await store.update(field, (existingData) => {
        if (Array.isArray(existingData)) {
          return [...existingData, ...items];
        } else {
          return items;
        }
      });
    },
    delete: async <T>(field: string): Promise<T> => {
      const fieldParts = field.split(".");
      const parentField = fieldParts.slice(0, -1).join(".");
      const fieldToDelete = fieldParts.slice(-1)[0];

      let deletedData = undefined as unknown as T;

      await store.update(parentField, (data) => {
        const { [fieldToDelete]: dataToDelete, ...dataToKeep } = (data || {});
        deletedData = dataToDelete;
        return dataToKeep;
      });

      return deletedData;
    },
    updateElement: async <T>(
      field: string,
      finder: (el: T) => Boolean,
      updater: (current: any) => any | Promise<any>
    ) => {
      return store.update(field, async (current) => {
        const newElements = await Promise.all(
          current.map(async (element: T) => {
            if (finder(element) === true) {
              return await updater(element);
            } else {
              return element;
            }
          })
        );
        return newElements;
      });
    },
    deleteElement: async <T>(field: string, finder: (el: T) => Boolean) => {
      return store.update(field, async (current) => {
        const newElements = [];
        for (const el of current) {
          if (!finder(el)) {
            newElements.push(el);
          }
        }
        return newElements;
      });
    },
  };
  if (fs.existsSync(getRapiderPath()) === false) {
    await util.promisify(fs.mkdir)(getRapiderPath());
  }
  if (fs.existsSync(store.path) === false) {
    await util.promisify(fs.mkdir)(store.path);
  }
  if (fs.existsSync(store.dataPath) === false) {
    await util.promisify(fs.writeFile)(store.dataPath, JSON.stringify({}));
  }

  return store;
}
