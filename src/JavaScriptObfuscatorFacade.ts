import 'reflect-metadata';

import { ServiceIdentifiers } from './container/ServiceIdentifiers';

import { TInputOptions } from './types/options/TInputOptions';

import { IInversifyContainerFacade } from './interfaces/container/IInversifyContainerFacade';
import { IJavaScriptObfuscator } from './interfaces/IJavaScriptObfsucator';
import { IObfuscatedCode } from './interfaces/source-code/IObfuscatedCode';

import { InversifyContainerFacade } from './container/InversifyContainerFacade';
import { TNodeWithLexicalScope } from './types/node/TNodeWithLexicalScope';
import { ITransformersRunner } from './interfaces/node-transformers/ITransformersRunner';

class JavaScriptObfuscatorFacade {
    /**
     * @type {string | undefined}
     */
    public static version: string = process.env.VERSION || 'unknown';

    /**
     * @type {string | undefined}
     */
    public static identifier_mapping: string = 'none';

    /**
     * @param {string} sourceCode
     * @param {TInputOptions} inputOptions
     * @returns {IObfuscatedCode}
     */
    public static obfuscate (sourceCode: string, inputOptions: TInputOptions = {}): IObfuscatedCode {
        const inversifyContainerFacade: IInversifyContainerFacade = new InversifyContainerFacade();

        inversifyContainerFacade.load(sourceCode, '', inputOptions);

        const javaScriptObfuscator: IJavaScriptObfuscator = inversifyContainerFacade
            .get<IJavaScriptObfuscator>(ServiceIdentifiers.IJavaScriptObfuscator);
        const obfuscatedCode: IObfuscatedCode = javaScriptObfuscator.obfuscate(sourceCode);
        
        var transRunner : ITransformersRunner = inversifyContainerFacade.get(ServiceIdentifiers.ITransformersRunner);
        var namesMap : Map<TNodeWithLexicalScope, Map<string, string>> = transRunner.getNameMap();

        var mapStr = '';
        for (let names of namesMap.values()){
            let jsonMap : any = {};
            for(let [n1,n2] of names){
                jsonMap[n1] = n2;
            }

            mapStr += JSON.stringify(jsonMap);
        }

        this.identifier_mapping = mapStr;
            
        inversifyContainerFacade.unload();

        return obfuscatedCode;
    }
}

export { JavaScriptObfuscatorFacade as JavaScriptObfuscator };
