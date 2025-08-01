import React from 'react';
import type { StaticSectionItem, SortableListItem } from '@/types/db';
import type { SetRow } from "./db";

export interface HomeLayoutData {
    fideliList: SortableListItem[];
    infideliList: SortableListItem[];
}

export type PageComponentType = 'text' | 'about';

export interface LayoutUpdateItemArgs {
    item_id: string;
    item_type: 'page_component' | 'set';
    display_order: number;
    page_path: string;
}

export interface CreatePageComponentArgs {
    title: string;
    text: string;
    affiliation: 'FIDELI' | 'INFIDELI';
    pagePath?: string;
    type?: PageComponentType;
}

export interface DeleteHomepageItemArgs {
    itemId: string;
    itemType: 'page_component' | 'set';
    pagePath: string;
}

export interface UpdatePageComponentContentArgs {
    id: string;
    content?: Partial<any>;
    affiliation?: string;
    pagePath?: string;
}

export interface UpdateSetContentArgs {
    id: string;
    updates: Partial<SetRow>;
    pagePath?: string;
}

export interface HomeDesignState {
    fideliList: SortableListItem[];
    infideliList: SortableListItem[];
    staticSections: StaticSectionItem[];
    renderKey: number;
    newComponentTitle: string;
    newComponentText: string;
    editingItem: SortableListItem | null;
    isEditModalOpen: boolean;
    newComponentAffiliation: 'FIDELI' | 'INFIDELI' | '' | undefined;
}

export interface HomeDesignActions {
    handleCreateComponent: (event: React.FormEvent) => Promise<void>;
    setNewComponentTitle: (title: string) => void;
    setNewComponentText: (text: string) => void;
    setNewComponentAffiliation: (affiliation: 'FIDELI' | 'INFIDELI' | '' | undefined) => void;
    handleDragEnd: (event: any) => void;
    openEditModal: (item: SortableListItem) => void;
    closeEditModal: () => void;
    setEditingItem: (item: SortableListItem | null) => void;
    handleSaveEdit: (saveData: any) => Promise<void>;
    handleDeleteItem: (itemId: string, itemType: 'page_component' | 'set') => Promise<void>;
    refetchLayout: () => void;
}

export interface HomeDesignStatus {
    loading: boolean;
    error: any;
    isCreatingComponent: boolean;
    isUpdatingLayout: boolean;
    isDeletingItem: boolean;
    isUpdatingContent: boolean;
} 