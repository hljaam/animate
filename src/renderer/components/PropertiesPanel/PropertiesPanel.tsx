import React, { useState, useEffect } from 'react'
import DocumentTab from './DocumentTab'
import LayerTab from './LayerTab'
import LibraryPanel from '../LibraryPanel/LibraryPanel'
import { useEditorStore } from '../../store/editorStore'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'

type Tab = 'document' | 'layer' | 'library'

export default function PropertiesPanel(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('layer')
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds)

  useEffect(() => {
    setActiveTab(selectedLayerIds.length > 0 ? 'layer' : 'document')
  }, [selectedLayerIds])

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as Tab)}
      className="panel flex flex-col overflow-hidden w-full flex-1"
    >
      <TabsList>
        <TabsTrigger value="document">PROPERTIES</TabsTrigger>
        <TabsTrigger value="layer">LAYER</TabsTrigger>
      </TabsList>

      <TabsContent value="document">
        <DocumentTab />
      </TabsContent>
      <TabsContent value="layer">
        <LayerTab onSwitchTab={() => setActiveTab('document')} />
      </TabsContent>
    </Tabs>
  )
}
