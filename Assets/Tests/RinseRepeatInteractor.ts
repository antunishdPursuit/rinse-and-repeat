import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"

/**
 * LEAF interactor for grab-and-carry. LEAF 2.0.2 adds its drag vector on SIK drag-update
 * events, which SIK 0.18 never fires for a scripted interactor (it recomputes the drag
 * vector each frame). So the grab is held with a zero-vector LEAF drag and the simulated
 * pointer is moved here every frame. SIK's InteractableManipulation then carries the
 * object exactly as it would follow a moving hand.
 */
export class RinseRepeatInteractor extends DefaultLeafInteractor {
  /** Grab `target`, move it by `totalMove` (world cm) over most of `durationMs`, then let go. */
  async carry(target: Interactable, totalMove: vec3, durationMs: number): Promise<void> {
    // Direct (hand) grab: SIK keeps the object at a fixed offset from the pinch point.
    const previousMode = this.targetingMode
    this.targetingMode = TargetingMode.Direct
    try {
      await this.carryHeld(target, totalMove, durationMs)
    } finally {
      this.targetingMode = previousMode
    }
  }

  private async carryHeld(target: Interactable, totalMove: vec3, durationMs: number): Promise<void> {
    const drag = this.drag(target, vec3.zero(), durationMs)
    const moveSecs = (durationMs / 1000) * 0.75
    let started = -1
    let done = 0
    let finished = false
    drag.then(() => (finished = true))
    while (!finished) {
      await nextFrame()
      if (started < 0) {
        // Wait until the grab has started before moving.
        if (this.overrideDragVector === undefined) continue
        started = getTime()
      }
      const k = Math.min(1, (getTime() - started) / moveSecs)
      if (k > done) {
        const step = totalMove.uniformScale(k - done)
        done = k
        this.startPoint = this.startPoint.add(step)
        this.endPoint = this.endPoint.add(step)
      }    }
    await drag
  }
}
