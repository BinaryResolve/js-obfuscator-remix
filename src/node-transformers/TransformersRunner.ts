import { inject, injectable } from 'inversify';
import { ServiceIdentifiers } from '../container/ServiceIdentifiers';

import * as estraverse from 'estraverse';
import * as ESTree from 'estree';

import { TNodeTransformerFactory } from '../types/container/node-transformers/TNodeTransformerFactory';
import { TVisitorDirection } from '../types/node-transformers/TVisitorDirection';
import { TVisitorFunction } from '../types/node-transformers/TVisitorFunction';
import { TVisitorResult } from '../types/node-transformers/TVisitorResult';

import { ITransformersRunner } from '../interfaces/node-transformers/ITransformersRunner';
import { IVisitor } from '../interfaces/node-transformers/IVisitor';

import { NodeTransformer } from '../enums/node-transformers/NodeTransformer';
import { TransformationStage } from '../enums/node-transformers/TransformationStage';
import { VisitorDirection } from '../enums/node-transformers/VisitorDirection';

import { NodeGuards } from '../node/NodeGuards';
import { NodeMetadata } from '../node/NodeMetadata';
import { INodeTransformer } from '../interfaces/node-transformers/INodeTransformer';
import { VariableDeclarationTransformer } from './obfuscating-transformers/VariableDeclarationTransformer';
import { IIdentifierObfuscatingReplacer } from '../interfaces/node-transformers/obfuscating-transformers/obfuscating-replacers/IIdentifierObfuscatingReplacer';
import { TNodeWithLexicalScope } from '../types/node/TNodeWithLexicalScope';

@injectable()
export class TransformersRunner implements ITransformersRunner {
    /**
     * @type {TNodeTransformerFactory}
     */
    private readonly nodeTransformerFactory: TNodeTransformerFactory;

    /**
     * @type {Map<TNodeWithLexicalScope, Map<string, string>>}
     */
    private nameMap: Map<TNodeWithLexicalScope, Map<string, string>>;

    /**
     * @param {TNodeTransformerFactory} nodeTransformerFactory
     */
    constructor (
        @inject(ServiceIdentifiers.Factory__INodeTransformer) nodeTransformerFactory: TNodeTransformerFactory,
    ) {
        this.nodeTransformerFactory = nodeTransformerFactory;
        this.nameMap = new Map();
    }

    /**
     * @param {T} astTree
     * @param {NodeTransformer[]} nodeTransformers
     * @param {TransformationStage} transformationStage
     * @returns {T}
     */
    public transform <T extends ESTree.Node = ESTree.Program> (
        astTree: T,
        nodeTransformers: NodeTransformer[],
        transformationStage: TransformationStage
    ): T {
        if (!nodeTransformers.length) {
            return astTree;
        }

        const enterVisitors: IVisitor[] = [];
        const leaveVisitors: IVisitor[] = [];
        let varTransformer: any = "none";

        const nodeTransformersLength: number = nodeTransformers.length;

        let visitor: IVisitor | null;

        for (let i: number = 0; i < nodeTransformersLength; i++) {
            const nodeTransformer: INodeTransformer = this.nodeTransformerFactory(nodeTransformers[i]);
            visitor = nodeTransformer.getVisitor(transformationStage);
            // visitor = this.nodeTransformerFactory(nodeTransformers[i]).getVisitor(transformationStage);
            
            if (nodeTransformer instanceof VariableDeclarationTransformer) {
                varTransformer = nodeTransformer;
            }

            if (!visitor) {
                continue;
            }

            if (visitor.enter) {
                enterVisitors.push({ enter: visitor.enter });
            }

            if (visitor.leave) {
                leaveVisitors.push({ leave: visitor.leave });
            }
        }

        if (!enterVisitors.length && !leaveVisitors.length) {
            return astTree;
        }

        estraverse.replace(astTree, {
            enter: this.mergeVisitorsForDirection(enterVisitors, VisitorDirection.Enter),
            leave: this.mergeVisitorsForDirection(leaveVisitors, VisitorDirection.Leave)
        });
        
        if (varTransformer !== "none") {
            const replacer: IIdentifierObfuscatingReplacer = varTransformer.getObfuscatingReplacer();
            this.nameMap = replacer.getNameMap();
        }

        return astTree;
    }

    public getNameMap (): Map<TNodeWithLexicalScope, Map<string, string>> {
        return this.nameMap;
    }

    /**
     * @param {IVisitor[]} visitors
     * @param {TVisitorDirection} direction
     * @returns {TVisitorFunction}
     */
    private mergeVisitorsForDirection (visitors: IVisitor[], direction: TVisitorDirection): TVisitorFunction {
        const visitorsLength: number = visitors.length;

        if (!visitorsLength) {
            return (node: ESTree.Node, parentNode: ESTree.Node | null) => node;
        }

        return (node: ESTree.Node, parentNode: ESTree.Node | null) => {
            if (NodeMetadata.isIgnoredNode(node)) {
                return estraverse.VisitorOption.Skip;
            }

            for (let i: number = 0; i < visitorsLength; i++) {
                const visitorFunction: TVisitorFunction | undefined = visitors[i][direction];

                if (!visitorFunction) {
                    continue;
                }

                const visitorResult: TVisitorResult = visitorFunction(node, parentNode);

                if (!visitorResult || !NodeGuards.isNode(visitorResult)) {
                    continue;
                }

                node = visitorResult;
            }

            return node;
        };
    }
}
