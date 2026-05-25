import { createContext, useContext } from 'react'

interface TaskSelectionContextValue {
  selectedTaskId: string | null
  selectTask: (id: string | null) => void
}

const TaskSelectionContext = createContext<TaskSelectionContextValue>({
  selectedTaskId: null,
  selectTask: () => undefined,
})

export const TaskSelectionProvider = TaskSelectionContext.Provider

export const useTaskSelection = () => useContext(TaskSelectionContext)
