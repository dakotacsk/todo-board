export const statuses = ['Backlog','Todo','In progress','Done'];
export const colors = ['#a99bf5','#e5ad6e','#79bea4','#77afe5','#df8fa5','#c5bd71'];
export const initial = () => ({version:1,categories:[{id:'work',name:'Work',color:colors[0]},{id:'personal',name:'Personal',color:colors[1]},{id:'learning',name:'Learning',color:colors[2]}],tasks:[]});
export const dateKey = date => {const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function transition(task,status,now=new Date().toISOString()) {return {...task,status,completedAt:status==='Done'?(task.completedAt||now):null};}
export function totals(tasks,date,hour=null) {return tasks.filter(t=>t.status==='Done'&&t.completedAt&&dateKey(t.completedAt)===date&&(hour===null||new Date(t.completedAt).getHours()===hour)).reduce((a,t)=>({points:a.points+t.points,tickets:a.tickets+1}),{points:0,tickets:0});}
export function validate(data) {
 if(!data||data.version!==1||!Array.isArray(data.categories)||!Array.isArray(data.tasks))throw Error('This is not a Daymark backup.');
 const ids=new Set(); for(const c of data.categories){if(typeof c.id!=='string'||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||!/^#[0-9a-f]{6}$/i.test(c.color))throw Error('Invalid category.');ids.add(c.id);}
 const taskIds=new Set();for(const t of data.tasks){if(typeof t.id!=='string'||taskIds.has(t.id)||typeof t.title!=='string'||!t.title.trim()||typeof t.description!=='string'||!statuses.includes(t.status)||!Number.isInteger(t.points)||t.points<0||t.points>100||!['None','Low','Medium','High'].includes(t.priority)||(t.category&&!ids.has(t.category))||(t.status==='Done'&&(!t.completedAt||!Number.isFinite(Date.parse(t.completedAt)))))throw Error('Invalid task.');taskIds.add(t.id);}
 return data;
}
