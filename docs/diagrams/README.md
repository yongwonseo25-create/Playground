# Excalidraw Intake Workflow

This folder is the visual intake point for diagram-driven work.

## Accepted Files
- `.excalidraw`
- `.png`
- `.svg`

## Operating Rule
- Any new diagram placed in this folder is treated as an implementation brief for the next Codex task.
- Codex must scan this folder before starting diagram-driven work and use the newest relevant file as the primary visual source.
- If both a `.excalidraw` file and a rendered image exist for the same concept, the `.excalidraw` file is the source of truth and the image is the visual reference.

## File Naming Guidance
- Use descriptive names such as `voice-flow-v1.excalidraw` or `landing-wireframe-home.png`.
- Prefer one feature or flow per file.

## Expected Codex Behavior
- Read the diagram file or inspect the rendered asset.
- Translate the visual into concrete implementation tasks.
- Preserve Voxera constitutional rules while implementing changes.
- Ask for clarification only when the diagram is ambiguous in a way that would create product or architecture risk.

## Visual Interpretation Priority
1. Structural layout and user flow
2. Component hierarchy
3. Interaction intent
4. Copy and annotation details
5. Styling cues that fit the existing design system
