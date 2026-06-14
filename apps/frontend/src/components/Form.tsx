
import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { toast } from "sonner"
import axios from "axios"
import { BACKEND_URL } from "@/lib/config"
import { Navigate, useNavigate } from "react-router"

const Form = () => {

  const [github, setGithub] = useState("");
  const [linkedIn, setLinkedIn] = useState("");
  const [loading,setLoading]=useState(false);
  const navigate=useNavigate();

  async function onSubmit() {
    if (!github && !linkedIn) {
      toast('please provide valid Github and LinkedIn Url');
      return;
    }

    const response=await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
      linkedIn,
      github
    })

    setLoading(true);
    navigate(`/interview/${response.data.interviewId}`);
  }

  return (
    <div className="h-screen w-screen flex justify-center items-center">
      <div>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">AI-Interviewer</h2>
        <div className="p-2">
          <Input placeholder="LinkdIn Url" onChange={e => setLinkedIn(e.target.value)} />
        </div>
        <div className="p-2">
          <Input placeholder="Github Url" onChange={e => setGithub(e.target.value)} />
        </div>
        <div className="justify-center flex p-4">
          <Button disabled={loading} onClick={onSubmit}>{loading?"Starting Interview...":"Start Interview"}</Button>
        </div>
      </div>
    </div>
  )
}

export default Form
