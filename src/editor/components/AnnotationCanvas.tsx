import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { Attachment, AnnotationData } from '@/types';
import { ANNOTATION_COLORS } from '@/core/constants';

type AnnotationTool = 'select' | 'arrow' | 'rectangle' | 'text' | 'blur';

interface Point {
    x: number;
    y: number;
}

interface CommentPopup {
    visible: boolean;
    x: number;
    y: number;
    annotationId: string;
}

interface TextInput {
    visible: boolean;
    x: number;
    y: number;
    value: string;
}

export interface AnnotationCanvasRef {
    getAnnotatedImage: () => string | null;
}

interface Props {
    attachment: Attachment | null;
    onUpdate: (attachment: Attachment) => void;
}

export const AnnotationCanvas = forwardRef<AnnotationCanvasRef, Props>(
    ({ attachment, onUpdate }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const imageRef = useRef<HTMLImageElement | null>(null);

        const [tool, setTool] = useState<AnnotationTool>('arrow');
        const [color, setColor] = useState<string>(ANNOTATION_COLORS[0]);
        const [annotations, setAnnotations] = useState<AnnotationData[]>(
            attachment?.annotations || []
        );
        const [redoStack, setRedoStack] = useState<AnnotationData[][]>([]);
        const [selectedId, setSelectedId] = useState<string | null>(null);
        const [isDrawing, setIsDrawing] = useState(false);
        const [currentAnnotation, setCurrentAnnotation] = useState<AnnotationData | null>(null);
        const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
        const [imageLoaded, setImageLoaded] = useState(false);

        // Popup states
        const [commentPopup, setCommentPopup] = useState<CommentPopup>({
            visible: false,
            x: 0,
            y: 0,
            annotationId: '',
        });
        const [textInput, setTextInput] = useState<TextInput>({
            visible: false,
            x: 0,
            y: 0,
            value: '',
        });

        // Expose getAnnotatedImage to parent
        useImperativeHandle(ref, () => ({
            getAnnotatedImage: () => {
                const canvas = canvasRef.current;
                if (!canvas) return null;
                return canvas.toDataURL('image/png');
            },
        }));

        // Generate unique ID
        const generateId = () => Math.random().toString(36).substring(2, 9);

        // Load image
        useEffect(() => {
            if (!attachment?.dataUrl) return;

            const img = new Image();
            img.onload = () => {
                imageRef.current = img;

                // Get container dimensions for edge-to-edge sizing
                const container = containerRef.current;
                const padding = 32; // Small padding around canvas
                const availableWidth = container ? container.clientWidth - padding : window.innerWidth - 450;
                const availableHeight = container ? container.clientHeight - 80 : window.innerHeight - 150;

                let width = img.width;
                let height = img.height;

                // Scale to fit available space while maintaining aspect ratio
                const scaleX = availableWidth / width;
                const scaleY = availableHeight / height;
                const scale = Math.min(scaleX, scaleY, 1); // Don't upscale

                width = Math.round(width * scale);
                height = Math.round(height * scale);

                setCanvasSize({ width, height });
                setImageLoaded(true);
            };
            img.src = attachment.dataUrl;
        }, [attachment?.dataUrl]);

        // Render canvas
        const renderCanvas = useCallback(() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx || !imageRef.current) return;

            // Clear and draw image
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

            // Draw all annotations
            const allAnnotations = currentAnnotation
                ? [...annotations, currentAnnotation]
                : annotations;

            allAnnotations.forEach((ann) => {
                const isSelected = ann.id === selectedId;
                drawAnnotation(ctx, ann, isSelected);
            });
        }, [annotations, currentAnnotation, selectedId]);

        useEffect(() => {
            if (imageLoaded) {
                renderCanvas();
            }
        }, [imageLoaded, renderCanvas, canvasSize]);

        // Draw single annotation
        const drawAnnotation = (
            ctx: CanvasRenderingContext2D,
            ann: AnnotationData,
            isSelected: boolean
        ) => {
            ctx.strokeStyle = ann.color;
            ctx.fillStyle = ann.color;
            ctx.lineWidth = isSelected ? 4 : 3;

            switch (ann.type) {
                case 'arrow':
                    drawArrow(ctx, ann.startX, ann.startY, ann.endX!, ann.endY!);
                    if (ann.text) {
                        // Draw text at START of arrow (where user began drawing)
                        drawTextLabel(ctx, ann.text, ann.startX, ann.startY - 10, ann.color);
                    }
                    break;

                case 'rectangle':
                    const rectWidth = ann.endX! - ann.startX;
                    const rectHeight = ann.endY! - ann.startY;
                    ctx.strokeRect(ann.startX, ann.startY, rectWidth, rectHeight);
                    if (ann.text) {
                        drawTextLabel(ctx, ann.text, ann.startX + rectWidth / 2, ann.startY - 10, ann.color);
                    }
                    break;

                case 'text':
                    if (ann.text) {
                        ctx.font = 'bold 16px -apple-system, sans-serif';
                        ctx.fillStyle = ann.color;

                        // Background for readability
                        const metrics = ctx.measureText(ann.text);
                        const padding = 4;
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(
                            ann.startX - padding,
                            ann.startY - 16 - padding,
                            metrics.width + padding * 2,
                            20 + padding
                        );

                        ctx.fillStyle = ann.color;
                        ctx.fillText(ann.text, ann.startX, ann.startY);
                    }
                    break;

                case 'blur':
                    const blurWidth = Math.abs(ann.endX! - ann.startX);
                    const blurHeight = Math.abs(ann.endY! - ann.startY);
                    const blurX = Math.min(ann.startX, ann.endX!);
                    const blurY = Math.min(ann.startY, ann.endY!);

                    ctx.fillStyle = 'rgba(128, 128, 128, 0.8)';
                    ctx.fillRect(blurX, blurY, blurWidth, blurHeight);
                    break;
            }

            // Selection indicator
            if (isSelected) {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;

                const bounds = getAnnotationBounds(ann);
                ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
                ctx.setLineDash([]);
            }
        };

        const drawArrow = (
            ctx: CanvasRenderingContext2D,
            fromX: number,
            fromY: number,
            toX: number,
            toY: number
        ) => {
            const headLength = 15;
            const angle = Math.atan2(toY - fromY, toX - fromX);

            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(
                toX - headLength * Math.cos(angle - Math.PI / 6),
                toY - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                toX - headLength * Math.cos(angle + Math.PI / 6),
                toY - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
        };

        const drawTextLabel = (
            ctx: CanvasRenderingContext2D,
            text: string,
            x: number,
            y: number,
            textColor: string
        ) => {
            ctx.font = '14px -apple-system, sans-serif';
            const metrics = ctx.measureText(text);
            const padding = 6;
            const boxWidth = metrics.width + padding * 2;
            const boxHeight = 24;

            // Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
            ctx.beginPath();
            ctx.roundRect(x - boxWidth / 2, y - boxHeight - 5, boxWidth, boxHeight, 4);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // Text
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.fillText(text, x, y - 12);
            ctx.textAlign = 'start';
        };

        const getAnnotationBounds = (ann: AnnotationData) => {
            if (ann.type === 'text') {
                return { x: ann.startX, y: ann.startY - 20, width: 100, height: 25 };
            }
            const x = Math.min(ann.startX, ann.endX || ann.startX);
            const y = Math.min(ann.startY, ann.endY || ann.startY);
            const width = Math.abs((ann.endX || ann.startX) - ann.startX);
            const height = Math.abs((ann.endY || ann.startY) - ann.startY);
            return { x, y, width: Math.max(width, 20), height: Math.max(height, 20) };
        };

        // Get canvas coordinates from mouse event
        const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
            const canvas = canvasRef.current;
            if (!canvas) return { x: 0, y: 0 };
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        // Find annotation at point
        const findAnnotationAt = (point: Point): AnnotationData | null => {
            for (let i = annotations.length - 1; i >= 0; i--) {
                const ann = annotations[i];
                const bounds = getAnnotationBounds(ann);
                if (
                    point.x >= bounds.x - 10 &&
                    point.x <= bounds.x + bounds.width + 10 &&
                    point.y >= bounds.y - 10 &&
                    point.y <= bounds.y + bounds.height + 10
                ) {
                    return ann;
                }
            }
            return null;
        };

        // Mouse handlers
        const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
            const point = getCanvasCoords(e);

            // Close any open popups
            if (commentPopup.visible) {
                setCommentPopup({ visible: false, x: 0, y: 0, annotationId: '' });
            }

            if (tool === 'select') {
                const found = findAnnotationAt(point);
                setSelectedId(found?.id || null);
                return;
            }

            if (tool === 'text') {
                // Show inline text input
                const canvas = canvasRef.current;
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    setTextInput({
                        visible: true,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        value: '',
                    });
                }
                return;
            }

            // Start drawing
            setIsDrawing(true);
            setSelectedId(null);
            const newAnnotation: AnnotationData = {
                id: generateId(),
                type: tool as 'arrow' | 'rectangle' | 'blur',
                startX: point.x,
                startY: point.y,
                endX: point.x,
                endY: point.y,
                color,
            };
            setCurrentAnnotation(newAnnotation);
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!isDrawing || !currentAnnotation) return;

            const point = getCanvasCoords(e);
            setCurrentAnnotation({
                ...currentAnnotation,
                endX: point.x,
                endY: point.y,
            });
        };

        const handleMouseUp = () => {
            if (!isDrawing || !currentAnnotation) return;

            setIsDrawing(false);

            // Check if the annotation is too small (just a click)
            const dx = Math.abs((currentAnnotation.endX || 0) - currentAnnotation.startX);
            const dy = Math.abs((currentAnnotation.endY || 0) - currentAnnotation.startY);

            if (dx < 10 && dy < 10) {
                setCurrentAnnotation(null);
                return;
            }

            // Add annotation and show comment popup for arrows/rectangles
            const finalAnnotation = { ...currentAnnotation };
            setAnnotations((prev) => [...prev, finalAnnotation]);
            setCurrentAnnotation(null);

            // Show comment popup for arrows and rectangles
            if (finalAnnotation.type === 'arrow' || finalAnnotation.type === 'rectangle') {
                const canvas = canvasRef.current;
                if (canvas) {
                    let popupX: number;
                    let popupY: number;

                    if (finalAnnotation.type === 'arrow') {
                        // Position popup at the START of the arrow (where user began drawing)
                        popupX = finalAnnotation.startX;
                        popupY = finalAnnotation.startY - 20;
                    } else {
                        // For rectangles, position at top center
                        popupX = finalAnnotation.startX + (finalAnnotation.endX! - finalAnnotation.startX) / 2;
                        popupY = finalAnnotation.startY - 20;
                    }

                    setCommentPopup({
                        visible: true,
                        x: Math.max(120, Math.min(popupX, canvasSize.width - 120)),
                        y: Math.max(80, popupY),
                        annotationId: finalAnnotation.id,
                    });
                }
            }

            updateParent([...annotations, finalAnnotation]);
        };

        // Handle text input submission
        const handleTextSubmit = () => {
            if (textInput.value.trim()) {
                const newAnnotation: AnnotationData = {
                    id: generateId(),
                    type: 'text',
                    startX: textInput.x,
                    startY: textInput.y,
                    color,
                    text: textInput.value.trim(),
                };
                const newAnnotations = [...annotations, newAnnotation];
                setAnnotations(newAnnotations);
                updateParent(newAnnotations);
            }
            setTextInput({ visible: false, x: 0, y: 0, value: '' });
        };

        // Handle comment popup submission
        const handleCommentSubmit = (text: string) => {
            if (text.trim()) {
                const newAnnotations = annotations.map((ann) =>
                    ann.id === commentPopup.annotationId ? { ...ann, text: text.trim() } : ann
                );
                setAnnotations(newAnnotations);
                updateParent(newAnnotations);
            }
            setCommentPopup({ visible: false, x: 0, y: 0, annotationId: '' });
        };

        // Handle comment popup cancel
        const handleCommentCancel = () => {
            setCommentPopup({ visible: false, x: 0, y: 0, annotationId: '' });
        };

        // Delete selected annotation
        const handleDelete = useCallback(() => {
            if (selectedId) {
                const newAnnotations = annotations.filter((a) => a.id !== selectedId);
                setAnnotations(newAnnotations);
                setSelectedId(null);
                updateParent(newAnnotations);
            }
        }, [selectedId, annotations]);

        // Keyboard shortcuts
        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (!textInput.visible && !commentPopup.visible) {
                        handleDelete();
                    }
                }
                if (e.key === 'Escape') {
                    setTextInput({ visible: false, x: 0, y: 0, value: '' });
                    setCommentPopup({ visible: false, x: 0, y: 0, annotationId: '' });
                    setSelectedId(null);
                    setCurrentAnnotation(null);
                    setIsDrawing(false);
                }
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }, [handleDelete, textInput.visible, commentPopup.visible]);

        // Undo last annotation
        const handleUndo = () => {
            if (annotations.length === 0) return;
            const removed = annotations[annotations.length - 1];
            const newAnnotations = annotations.slice(0, -1);
            setAnnotations(newAnnotations);
            setRedoStack([...redoStack, [removed]]);
            updateParent(newAnnotations);
        };

        // Redo last undone annotation
        const handleRedo = () => {
            if (redoStack.length === 0) return;
            const toRestore = redoStack[redoStack.length - 1];
            const newRedoStack = redoStack.slice(0, -1);
            const newAnnotations = [...annotations, ...toRestore];
            setAnnotations(newAnnotations);
            setRedoStack(newRedoStack);
            updateParent(newAnnotations);
        };

        // Clear all annotations
        const handleClear = () => {
            setAnnotations([]);
            setSelectedId(null);
            setRedoStack([]);
            updateParent([]);
        };

        // Update parent component
        const updateParent = (newAnnotations: AnnotationData[]) => {
            if (!attachment) return;
            onUpdate({
                ...attachment,
                annotations: newAnnotations,
            });
        };

        // Get cursor style based on tool
        const getCursor = () => {
            if (tool === 'select') return 'default';
            if (tool === 'text') return 'text';
            return 'crosshair';
        };

        if (!attachment?.dataUrl) {
            return (
                <div className="annotation-container">
                    <div className="annotation-empty">
                        <p>No screenshot captured</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="annotation-container" ref={containerRef}>
                {/* Toolbar */}
                <div className="annotation-toolbar">
                    <div className="tool-group">
                        <button
                            className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
                            onClick={() => setTool('select')}
                            title="Select (click to select, Delete to remove)"
                        >
                            👆
                        </button>
                    </div>

                    <div className="tool-separator" />

                    <div className="tool-group">
                        <button
                            className={`tool-btn ${tool === 'arrow' ? 'active' : ''}`}
                            onClick={() => setTool('arrow')}
                            title="Arrow"
                        >
                            ➡️
                        </button>
                        <button
                            className={`tool-btn ${tool === 'rectangle' ? 'active' : ''}`}
                            onClick={() => setTool('rectangle')}
                            title="Rectangle"
                        >
                            ⬜
                        </button>
                        <button
                            className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
                            onClick={() => setTool('text')}
                            title="Text"
                        >
                            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>T</span>
                        </button>
                        <button
                            className={`tool-btn ${tool === 'blur' ? 'active' : ''}`}
                            onClick={() => setTool('blur')}
                            title="Blur/Redact"
                        >
                            🔲
                        </button>
                    </div>

                    <div className="tool-separator" />

                    <div className="color-picker">
                        {ANNOTATION_COLORS.map((c) => (
                            <button
                                key={c}
                                className={`color-btn ${color === c ? 'active' : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setColor(c)}
                                title={c}
                            />
                        ))}
                    </div>

                    <div className="tool-separator" />

                    <div className="tool-group">
                        <button
                            className="tool-btn"
                            onClick={handleUndo}
                            disabled={annotations.length === 0}
                            title="Undo"
                        >
                            ↩️
                        </button>
                        <button
                            className="tool-btn"
                            onClick={handleRedo}
                            disabled={redoStack.length === 0}
                            title="Redo"
                        >
                            ↪️
                        </button>
                        <button
                            className="tool-btn"
                            onClick={handleClear}
                            disabled={annotations.length === 0}
                            title="Clear All"
                        >
                            🗑️
                        </button>
                        {selectedId && (
                            <button className="tool-btn delete-btn" onClick={handleDelete} title="Delete Selected">
                                ❌
                            </button>
                        )}
                    </div>
                </div>

                {/* Canvas wrapper */}
                <div className="canvas-wrapper">
                    <div className="canvas-container" style={{ position: 'relative' }}>
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            className="annotation-canvas"
                            style={{ cursor: getCursor() }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={() => {
                                if (isDrawing) {
                                    setIsDrawing(false);
                                    setCurrentAnnotation(null);
                                }
                            }}
                        />

                        {/* Inline text input */}
                        {textInput.visible && (
                            <div
                                className="inline-text-input"
                                style={{
                                    position: 'absolute',
                                    left: textInput.x,
                                    top: textInput.y,
                                }}
                            >
                                <input
                                    type="text"
                                    autoFocus
                                    value={textInput.value}
                                    onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleTextSubmit();
                                        if (e.key === 'Escape') setTextInput({ visible: false, x: 0, y: 0, value: '' });
                                    }}
                                    onBlur={handleTextSubmit}
                                    placeholder="Type here..."
                                    style={{ color }}
                                />
                            </div>
                        )}

                        {/* Comment popup */}
                        {commentPopup.visible && (
                            <CommentPopupComponent
                                x={commentPopup.x}
                                y={commentPopup.y}
                                onSubmit={handleCommentSubmit}
                                onCancel={handleCommentCancel}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    }
);

AnnotationCanvas.displayName = 'AnnotationCanvas';

// Comment Popup Component
function CommentPopupComponent({
    x,
    y,
    onSubmit,
    onCancel,
}: {
    x: number;
    y: number;
    onSubmit: (text: string) => void;
    onCancel: () => void;
}) {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = () => {
        onSubmit(text);
    };

    return (
        <div
            className="comment-popup"
            style={{
                position: 'absolute',
                left: x,
                top: y,
            }}
        >
            <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                    if (e.key === 'Escape') onCancel();
                }}
                placeholder="Add a comment..."
            />
            <div className="comment-popup-actions">
                <button className="cancel-btn" onClick={onCancel}>
                    Cancel
                </button>
                <button className="submit-btn" onClick={handleSubmit}>
                    Add Comment
                </button>
            </div>
        </div>
    );
}
