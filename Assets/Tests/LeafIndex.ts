import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {DoorOpensWithTowelScenario} from "./C1DoorOpensWithTowelScenario"
import {TowelOnBarScenario} from "./C2TowelOnBarScenario"
import {WrongProductFirstScenario} from "./C3WrongProductFirstScenario"
import {ShampooUseScenario} from "./C4ShampooUseScenario"
import {FullRoutineScenario} from "./C5FullRoutineScenario"
import {ReachScenario} from "./RinseRepeatReachScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-door-opens-with-towel", typename: DoorOpensWithTowelScenario.getTypeName()},
    {id: "c2-towel-on-bar", typename: TowelOnBarScenario.getTypeName()},
    {id: "c3-wrong-product-first", typename: WrongProductFirstScenario.getTypeName()},
    {id: "c4-shampoo-use", typename: ShampooUseScenario.getTypeName()},
    {id: "c5-full-routine-learn-more", typename: FullRoutineScenario.getTypeName()},
    {id: "reach-ik-shampoo-learn-more", typename: ReachScenario.getTypeName()},
  ]
}
