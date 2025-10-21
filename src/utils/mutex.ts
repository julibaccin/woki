export class Mutex {
  private locks = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) || Promise.resolve();

    // Nueva promesa que se resolverá cuando se libere el lock
    let release: () => void;
    const current = new Promise<void>((resolve) => (release = resolve));

    // Encadenar la promesa actual a la anterior
    this.locks.set(
      key,
      previous.then(() => current)
    );

    await previous; // Esperar a que termine el lock anterior
    try {
      return await fn(); // Ejecutar la función protegida
    } finally {
      release!(); // Liberar el lock
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }
}

export const globalMutex = new Mutex();
