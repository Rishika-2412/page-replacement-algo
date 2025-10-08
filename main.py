"""
Page Replacement Algorithms Visualizer (Tkinter)

Supports: FIFO, LRU, Optimal

Usage: run with Python 3 (tkinter included in standard library)

Example: python3 page_replacement_visualizer.py
"""
import tkinter as tk
from tkinter import ttk, messagebox
import threading
import time

# ---------- Algorithms (produce step-by-step states) ----------

def simulate_fifo(refs, frames_count):
    frames = []
    fifo_idx = 0
    steps = []
    faults = 0
    for r in refs:
        hit = r in frames
        if not hit:
            if len(frames) < frames_count:
                frames.append(r)
            else:
                frames[fifo_idx] = r
                fifo_idx = (fifo_idx + 1) % frames_count
            faults += 1
        steps.append((list(frames) + [None] * max(0, frames_count - len(frames)), hit))
    return steps, faults


def simulate_lru(refs, frames_count):
    frames = []
    recent = []  # most recent at end
    steps = []
    faults = 0
    for r in refs:
        hit = r in frames
        if hit:
            # update recency
            recent.remove(r)
            recent.append(r)
        else:
            if len(frames) < frames_count:
                frames.append(r)
                recent.append(r)
            else:
                # evict least recently used
                lru = recent.pop(0)
                idx = frames.index(lru)
                frames[idx] = r
                recent.append(r)
            faults += 1
        steps.append((list(frames) + [None] * max(0, frames_count - len(frames)), hit))
    return steps, faults


def simulate_optimal(refs, frames_count):
    frames = []
    steps = []
    faults = 0
    n = len(refs)
    for i, r in enumerate(refs):
        hit = r in frames
        if hit:
            steps.append((list(frames) + [None] * max(0, frames_count - len(frames)), hit))
            continue
        if len(frames) < frames_count:
            frames.append(r)
            faults += 1
            steps.append((list(frames) + [None] * max(0, frames_count - len(frames)), False))
            continue
        # choose the page that is not used for the longest future time
        farthest = -1
        far_page = None
        for p in frames:
            try:
                nxt = refs.index(p, i + 1)
            except ValueError:
                nxt = float('inf')
            if nxt > farthest:
                farthest = nxt
                far_page = p
        idx = frames.index(far_page)
        frames[idx] = r
        faults += 1
        steps.append((list(frames), False))
    return steps, faults

ALGO_MAP = {
    "FIFO": simulate_fifo,
    "LRU": simulate_lru,
    "Optimal": simulate_optimal,
}

# ---------- GUI ----------

class VisualizerApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Page Replacement Algorithms Visualizer")
        self.geometry("900x600")
        self.resizable(True, True)

        self.create_controls()
        self.create_canvas_area()

        self.steps = []
        self.faults = 0
        self.current_step = 0
        self.animating = False

    def create_controls(self):
        frm = ttk.Frame(self)
        frm.pack(side=tk.TOP, fill=tk.X, padx=8, pady=8)

        ttk.Label(frm, text="Reference string (space or comma separated):").grid(row=0, column=0, sticky=tk.W)
        self.refs_entry = ttk.Entry(frm, width=40)
        self.refs_entry.grid(row=0, column=1, padx=6)
        self.refs_entry.insert(0, "7 0 1 2 0 3 0 4 2 3 0 3 2")

        ttk.Label(frm, text="Frames:").grid(row=0, column=2, sticky=tk.W, padx=(12,0))
        self.frames_spin = ttk.Spinbox(frm, from_=1, to=10, width=5)
        self.frames_spin.set(3)
        self.frames_spin.grid(row=0, column=3, sticky=tk.W)

        ttk.Label(frm, text="Algorithm:").grid(row=0, column=4, sticky=tk.W, padx=(12,0))
        self.algo_combo = ttk.Combobox(frm, values=list(ALGO_MAP.keys()), state="readonly", width=12)
        self.algo_combo.set("LRU")
        self.algo_combo.grid(row=0, column=5)

        run_btn = ttk.Button(frm, text="Run", command=self.on_run)
        run_btn.grid(row=0, column=6, padx=(12,0))

        step_btn = ttk.Button(frm, text="Step", command=self.on_step)
        step_btn.grid(row=0, column=7, padx=(6,0))

        anim_btn = ttk.Button(frm, text="Animate", command=self.on_animate)
        anim_btn.grid(row=0, column=8, padx=(6,0))

        reset_btn = ttk.Button(frm, text="Reset", command=self.reset)
        reset_btn.grid(row=0, column=9, padx=(6,0))

        ttk.Label(frm, text="Speed (s):").grid(row=0, column=10, sticky=tk.W, padx=(12,0))
        self.speed_spin = ttk.Spinbox(frm, from_=0.1, to=2.0, increment=0.1, width=5)
        self.speed_spin.set(0.8)
        self.speed_spin.grid(row=0, column=11)

    def create_canvas_area(self):
        # working area
        area = ttk.Frame(self)
        area.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)

        top = ttk.Frame(area)
        top.pack(side=tk.TOP, fill=tk.X)

        self.timeline_label = ttk.Label(top, text="Timeline: ", font=(None, 11))
        self.timeline_label.pack(anchor=tk.W)

        # frames display
        self.frames_display = ttk.Frame(area, borderwidth=2, relief=tk.RIDGE)
        self.frames_display.pack(fill=tk.BOTH, expand=False, padx=4, pady=6)

        footer = ttk.Frame(area)
        footer.pack(side=tk.BOTTOM, fill=tk.X)

        self.status_var = tk.StringVar(value="Ready")
        ttk.Label(footer, textvariable=self.status_var).pack(side=tk.LEFT)

        self.faults_var = tk.StringVar(value="Page Faults: 0")
        ttk.Label(footer, textvariable=self.faults_var).pack(side=tk.RIGHT)

    def parse_input(self):
        raw = self.refs_entry.get().strip()
        if not raw:
            return None, None
        parts = [p for p in raw.replace(',', ' ').split() if p != '']
        try:
            refs = [int(x) for x in parts]
        except ValueError:
            messagebox.showerror("Invalid input", "Reference string must contain integers separated by space or comma.")
            return None, None
        try:
            frames_count = int(self.frames_spin.get())
        except Exception:
            messagebox.showerror("Invalid frames", "Frames must be an integer.")
            return None, None
        if frames_count < 1:
            messagebox.showerror("Invalid frames", "Frames must be >= 1")
            return None, None
        return refs, frames_count

    def compute_steps(self, refs, frames_count, algo_name):
        func = ALGO_MAP.get(algo_name)
        if not func:
            raise ValueError("Unsupported algorithm")
        return func(refs, frames_count)

    def render_step(self, step_idx):
        # clear
        for child in self.frames_display.winfo_children():
            child.destroy()

        if not self.steps:
            return
        refs = self.refs
        frames_state, hit = self.steps[step_idx]

        # timeline
        timeline = "  ".join(str(x) for x in refs)
        pointer = "    " * step_idx + "^"
        self.timeline_label.config(text=f"Timeline: {timeline}\n        {pointer} (ref={refs[step_idx]})")

        # draw column for each frame row
        rows = len(frames_state)
        cols = 1
        # We'll show frames vertically as rows
        for i in range(rows):
            val = frames_state[i]
            cell = ttk.Label(self.frames_display, text=str(val) if val is not None else "-", borderwidth=1, relief=tk.SOLID, padding=8, width=6)
            cell.grid(row=i, column=0, padx=6, pady=6)

        # highlight if hit or fault
        if hit:
            self.status_var.set(f"Step {step_idx+1}: HIT (ref={refs[step_idx]})")
        else:
            self.status_var.set(f"Step {step_idx+1}: PAGE FAULT (ref={refs[step_idx]})")

        self.faults_var.set(f"Page Faults: {self.faults_so_far(step_idx)} / {len(self.steps)}")

    def faults_so_far(self, up_to_idx):
        # count faults up to and including up_to_idx
        cnt = 0
        for i in range(0, up_to_idx+1):
            _, hit = self.steps[i]
            if not hit:
                cnt += 1
        return cnt

    def on_run(self):
        parsed = self.parse_input()
        if parsed == (None, None):
            return
        refs, frames_count = parsed
        algo_name = self.algo_combo.get()
        self.refs = refs
        self.steps, self.faults = self.compute_steps(refs, frames_count, algo_name)
        self.current_step = 0
        self.render_step(0)
        self.faults_var.set(f"Page Faults: {self.faults} / {len(self.steps)}")

    def on_step(self):
        if not self.steps:
            self.on_run()
            return
        if self.current_step < len(self.steps) - 1:
            self.current_step += 1
            self.render_step(self.current_step)
        else:
            messagebox.showinfo("Finished", "Already at the last step.")

    def on_animate(self):
        if not self.steps:
            self.on_run()
            if not self.steps:
                return
        if self.animating:
            # stop
            self.animating = False
            return
        self.animating = True
        speed = float(self.speed_spin.get())

        def run_anim():
            while self.animating and self.current_step < len(self.steps) - 1:
                time.sleep(speed)
                self.current_step += 1
                # UI update must be scheduled in main thread
                self.after(0, lambda idx=self.current_step: self.render_step(idx))
            self.animating = False
        threading.Thread(target=run_anim, daemon=True).start()

    def reset(self):
        self.steps = []
        self.faults = 0
        self.current_step = 0
        self.refs = []
        for child in self.frames_display.winfo_children():
            child.destroy()
        self.status_var.set("Ready")
        self.faults_var.set("Page Faults: 0")
        self.timeline_label.config(text="Timeline: ")


if __name__ == '__main__':
    app = VisualizerApp()
    app.mainloop()