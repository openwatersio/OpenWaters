declare module "react-native-zeroconf" {
  import { EventEmitter } from "events";

  interface ZeroconfService {
    name: string;
    fullName: string;
    host: string;
    port: number;
    addresses: string[];
    txt: Record<string, string>;
  }

  class Zeroconf extends EventEmitter {
    scan(type?: string, protocol?: string, domain?: string): void;
    stop(): void;
    getServices(): Record<string, ZeroconfService>;
    publishService(
      type: string,
      protocol: string,
      domain: string,
      name: string,
      port: number,
      txt?: Record<string, string>,
    ): void;
    unpublishService(name: string): void;
  }

  export default Zeroconf;
}
