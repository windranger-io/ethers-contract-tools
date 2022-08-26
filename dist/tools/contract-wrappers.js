"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapImportedFactories = void 0;
const ethers_1 = require("ethers");
const FACTORY_SUFFIX = '__factory';
function wrapImportedFactories(imports, defaultSigner) {
    return new (class {
        findSignerAsync(s1, s2) {
            const s = s1 ?? s2 ?? defaultSigner;
            if (s) {
                return s;
            }
            throw new Error('Signer is not available');
        }
        findSigner(s1) {
            if (s1) {
                return s1;
            }
            if (ethers_1.Signer.isSigner(defaultSigner)) {
                return defaultSigner;
            }
            throw new Error('Signer is not available or needs to be resolved');
        }
        factoryClassByName(name) {
            const factoryClass = imports[`${name}${FACTORY_SUFFIX}`];
            if (!factoryClass) {
                throw new Error(`Factory is missing for contract type: ${name}`);
            }
            return factoryClass;
        }
        async deploy(name, deployArgs, signer) {
            const factoryClass = this.factoryClassByName(name);
            const factory = new factoryClass(await this.findSignerAsync(signer));
            const contract = await factory.deploy(...deployArgs);
            const deployed = (await contract.deployed());
            return deployed;
        }
        deployWithDelegate(delegateFn, signer) {
            const fn = async (name, deployArgs, signer2) => {
                const factoryClass = this.factoryClassByName(name);
                const factory = new factoryClass(await this.findSignerAsync(signer2, signer));
                return delegateFn(factory, deployArgs);
            };
            return fn;
        }
        attach(name, address, signer) {
            const factoryClass = this.factoryClassByName(name);
            return factoryClass.connect(address, this.findSigner(signer));
        }
        attachWithDelegate(delegateFn, signer) {
            const fn = async (name, address, signer2) => {
                const factoryClass = this.factoryClassByName(name);
                const factory = new factoryClass(await this.findSignerAsync(signer2, signer));
                return delegateFn(factory, address);
            };
            return fn;
        }
        interface(name) {
            const factoryClass = this.factoryClassByName(name);
            return factoryClass.createInterface();
        }
    })();
}
exports.wrapImportedFactories = wrapImportedFactories;
//# sourceMappingURL=contract-wrappers.js.map