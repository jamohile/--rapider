import os from "os";
import path from "path";
import fs from "fs";
import util from "util";

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
