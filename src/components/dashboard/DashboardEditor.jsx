import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, GripVertical, Maximize2, Columns2, RotateCcw } from 'lucide-react';
import { WIDGET_REGISTRY } from './widgetRegistry';

export default function DashboardEditor({ open, onOpenChange, layout, onToggle, onReorder, onResize, onReset }) {
  function handleDragEnd(result) {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            עריכת דשבורד
          </SheetTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            גרור לשינוי סדר, הפעל/כבה ווידג'טים, ובחר גודל תצוגה
          </p>
        </SheetHeader>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="dashboard-editor">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 pb-4">
                {layout.map((widget, index) => {
                  const config = WIDGET_REGISTRY[widget.id];
                  if (!config) return null;
                  const Icon = config.icon;

                  return (
                    <Draggable key={widget.id} draggableId={widget.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`rounded-xl border p-3 transition-all ${
                            snapshot.isDragging
                              ? 'border-blue-300 bg-blue-50 shadow-lg dark:border-blue-700 dark:bg-blue-950/30'
                              : widget.visible
                              ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                              : 'border-slate-100 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-5 w-5 text-slate-400" />
                            </div>

                            <div className={`rounded-lg p-1.5 ${widget.visible ? 'bg-slate-100 dark:bg-slate-700' : 'bg-slate-50 dark:bg-slate-800'}`}>
                              <Icon className={`h-4 w-4 ${widget.visible ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {config.label}
                              </Label>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {config.description}
                              </p>
                            </div>

                            <Switch
                              checked={widget.visible}
                              onCheckedChange={() => onToggle(widget.id)}
                            />
                          </div>

                          {widget.visible && (
                            <div className="mt-2 mr-8 flex gap-1">
                              <button
                                type="button"
                                onClick={() => onResize(widget.id, 'full')}
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                                  widget.size === 'full'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                <Maximize2 className="h-3 w-3" />
                                רוחב מלא
                              </button>
                              <button
                                type="button"
                                onClick={() => onResize(widget.id, 'half')}
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                                  widget.size === 'half'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                <Columns2 className="h-3 w-3" />
                                חצי רוחב
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button variant="outline" onClick={onReset} className="w-full gap-2">
            <RotateCcw className="h-4 w-4" />
            אפס לברירת מחדל
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
