import { Icon } from '../../components/Icon/index.js'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion.js'
import type { TaskCatalogBlock } from '../../types/subur-types.js'

type Group = TaskCatalogBlock['groups'][number]

function TaskList({ tasks }: { tasks: Group['tasks'] }) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task, index) => (
        <li
          className="flex gap-3 before:mt-[0.8em] before:h-[2px] before:w-3 before:shrink-0 before:bg-primary"
          key={task.id ?? index}
        >
          {task.text}
        </li>
      ))}
    </ul>
  )
}

export function TaskCatalog({ footnote, groups, heading, intro }: TaskCatalogBlock) {
  return (
    <section className="wrap py-section" data-block="taskCatalog">
      {(heading || intro) && (
        <div className="mb-12 grid gap-6 lg:grid-cols-12 lg:items-end">
          {heading && <h2 className="text-title lg:col-span-6">{heading}</h2>}
          {intro && <p className="text-lead text-muted-foreground lg:col-span-5 lg:col-start-8">{intro}</p>}
        </div>
      )}

      <div className="hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group, index) => (
          <section className="flex flex-col gap-4 border-[1.5px] border-primary bg-card p-6" key={group.id ?? index}>
            <div className="flex items-center gap-3 border-b border-primary pb-4">
              <Icon className="size-6 text-primary" name={group.icon} />
              <h3 className="text-subtitle">{group.title}</h3>
            </div>
            <TaskList tasks={group.tasks} />
          </section>
        ))}
      </div>

      <Accordion className="border-t border-primary md:hidden" type="multiple">
        {groups.map((group, index) => (
          <AccordionItem className="border-b border-primary" key={group.id ?? index} value={`group-${index}`}>
            <AccordionTrigger className="py-5 font-display text-subtitle hover:no-underline">
              <span className="flex items-center gap-3">
                <Icon className="size-6 text-primary" name={group.icon} />
                {group.title}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-6 text-body">
              <TaskList tasks={group.tasks} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {footnote && <p className="mt-10 max-w-[65ch] text-muted-foreground">{footnote}</p>}
    </section>
  )
}
