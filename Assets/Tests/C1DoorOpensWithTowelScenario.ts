import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {RinseRepeatInteractor} from "./RinseRepeatInteractor"
import {
  MSG_BODY_CHOICE,
  MSG_CORRECT,
  MSG_FINISH,
  MSG_INCORRECT,
  MSG_LEARN,
} from "../Scripts/RinseRepeatController"
import {
  controller,
  dragTowelToBar,
  interactable,
  obj,
  pickUpAndRelease,
  textOf,
  useProduct,
  visible,
  waitFor,
  worldPos,
} from "./RinseRepeatTestUtils"

/**
 * Done criterion 1: grabbing the towel from the bed and pinching the bathroom door handle
 * opens the door; a bright light fades to show the bathroom. Once picked up, the towel
 * hangs like cloth and stays with the user.
 */
@component
export class DoorOpensWithTowelScenario extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new RinseRepeatInteractor()
    c.resetToOpening()
    await sleep(500)

    expect(visible("TowelSign"), "towel reminder sign shows at start").toBe(true)
    expect(visible("TowelMarker"), "glowing marker shows over the towel at start").toBe(true)

    // Guard: the handle does nothing until the towel has been picked up.
    await interactor.trigger(interactable("DoorHandle"))
    await sleep(400)
    expect(c.stage, "door stays shut without the towel").toBe("opening")

    // Grab the towel.
    await interactor.carry(interactable("Towel"), new vec3(0, 3, 0), 600)
    await sleep(200)
    expect(c.towelTaken, "towel counts as taken").toBe(true)
    expect(visible("TowelSign"), "reminder sign hides once the towel is picked up").toBe(false)
    expect(visible("TowelMarker"), "marker hides once the towel is picked up").toBe(false)
    expect(c.towelState, "let go, the towel stays with the user").toBe("carried")
    expect(visible("TowelHanging"), "towel hangs unfolded").toBe(true)
    expect(visible("TowelFolded"), "folded towel is gone from the bed").toBe(false)

    // Pinch the handle: the door opens and the bright light comes up.
    await interactor.trigger(interactable("DoorHandle"))
    const lightShown = await waitFor(() => visible("BrightLight"), 2500)
    expect(lightShown, "bright light appears after the door opens").toBe(true)

    // The light fades and reveals the bathroom.
    const lightGone = await waitFor(() => !visible("BrightLight"), 4000)
    expect(lightGone, "bright light fades away").toBe(true)
    expect(visible("Bathroom"), "bathroom is shown").toBe(true)
    expect(visible("PutTowelText"), "towel bar prompt shows").toBe(true)
    expect(c.towelState, "towel is still carried after walking through").toBe("carried")
    expect(c.stage).toBe("towelToBar")
  }
}
