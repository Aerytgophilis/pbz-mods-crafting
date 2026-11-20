"""Render FModel "Properties (.json)" exports of Blueprints as compact text.

Usage:  python -I tools/scripts/kismet2txt.py <export.json> [more.json ...] > out.txt

For each package it prints:
  - the class and its Super
  - the CDO (Default__*) properties, abbreviated
  - every Function's bytecode, one statement per line, prefixed by its code offset

Only reads JSON written by FModel with "Serialize Script Bytecode" enabled.
The output is a reading aid; check anything important against the JSON.
"""
import json
import sys


def short_obj(o):
    if isinstance(o, dict):
        name = o.get("ObjectName") or ""
        path = o.get("ObjectPath") or ""
        if "'" in name:
            name = name.split("'")[1]
        if name:
            return name
        return path
    return str(o)


def var_name(v):
    if not isinstance(v, dict):
        return str(v)
    if "Path" in v:
        return ".".join(v["Path"])
    prop = v.get("Property")
    if isinstance(prop, dict) and "Name" in prop:
        return prop["Name"]
    if "Variable" in v:
        return var_name(v["Variable"])
    return "?"


def fn_name(f):
    if isinstance(f, str):
        return f
    n = short_obj(f)
    return n.split(":")[-1]


def r(e):
    """Render one expression."""
    if e is None:
        return "None"
    if isinstance(e, list):
        return ", ".join(r(x) for x in e)
    if not isinstance(e, dict):
        return json.dumps(e, ensure_ascii=False)
    t = e.get("Token", "")
    if t in ("EX_LocalVariable", "EX_InstanceVariable", "EX_LocalOutVariable",
             "EX_DefaultVariable", "EX_ClassSparseDataVariable"):
        pre = {"EX_InstanceVariable": "self.", "EX_DefaultVariable": "default."}.get(t, "")
        return pre + var_name(e.get("Variable"))
    if t in ("EX_Let", "EX_LetObj", "EX_LetBool", "EX_LetWeakObjPtr", "EX_LetDelegate",
             "EX_LetMulticastDelegate", "EX_LetValueOnPersistentFrame"):
        lhs = e.get("Variable") or e.get("DestinationProperty")
        lhs_s = r(lhs) if isinstance(lhs, dict) and "Token" in lhs else var_name(lhs)
        return f"{lhs_s} = {r(e.get('Expression') or e.get('AssignmentExpression'))}"
    if t in ("EX_CallMath", "EX_FinalFunction", "EX_LocalFinalFunction", "EX_VirtualFunction",
             "EX_LocalVirtualFunction", "EX_CallMulticastDelegate"):
        return f"{fn_name(e.get('Function'))}({r(e.get('Parameters', []))})"
    if t in ("EX_Context", "EX_Context_FailSilent", "EX_ClassContext"):
        return f"{r(e.get('ObjectExpression'))}.{r(e.get('ContextExpression'))}"
    if t == "EX_InterfaceContext":
        return r(e.get("InterfaceValue"))
    if t == "EX_StructMemberContext":
        return f"{r(e.get('StructExpression'))}.{var_name(e.get('Property'))}"
    if t == "EX_JumpIfNot":
        return f"if not ({r(e.get('BooleanExpression'))}) goto {e.get('CodeOffset')}"
    if t == "EX_Jump":
        return f"goto {e.get('CodeOffset')}"
    if t == "EX_ComputedJump":
        return f"goto computed {r(e.get('CodeOffsetExpression'))}"
    if t == "EX_PushExecutionFlow":
        return f"push_flow {e.get('PushingAddress')}"
    if t == "EX_PopExecutionFlow":
        return "pop_flow"
    if t == "EX_PopExecutionFlowIfNot":
        return f"pop_flow_if_not ({r(e.get('BooleanExpression'))})"
    if t == "EX_Return":
        return f"return {r(e.get('ReturnExpression'))}"
    if t in ("EX_IntConst", "EX_FloatConst", "EX_DoubleConst", "EX_ByteConst", "EX_Int64Const",
             "EX_UInt64Const", "EX_IntConstByte", "EX_StringConst", "EX_UnicodeStringConst",
             "EX_SkipOffsetConst", "EX_BitFieldConst"):
        return json.dumps(e.get("Value"), ensure_ascii=False)
    if t == "EX_NameConst":
        return "N'" + str(e.get("Value")) + "'"
    if t == "EX_TextConst":
        v = e.get("Value", {})
        return "T" + json.dumps(v.get("SourceString") or v, ensure_ascii=False)
    if t == "EX_IntZero":
        return "0"
    if t == "EX_IntOne":
        return "1"
    if t == "EX_True":
        return "true"
    if t == "EX_False":
        return "false"
    if t in ("EX_NoObject", "EX_NoInterface"):
        return "null"
    if t == "EX_Self":
        return "self"
    if t in ("EX_ObjectConst", "EX_SoftObjectConst"):
        return "obj<" + short_obj(e.get("Value")) + ">"
    if t == "EX_VectorConst":
        v = e.get("Value", {})
        return f"Vec({v.get('X')},{v.get('Y')},{v.get('Z')})"
    if t == "EX_RotationConst":
        v = e.get("Value", {})
        return f"Rot({v.get('Pitch')},{v.get('Yaw')},{v.get('Roll')})"
    if t == "EX_StructConst":
        return f"{short_obj(e.get('Struct'))}{{{r(e.get('Properties', []))}}}"
    if t in ("EX_ArrayConst", "EX_SetConst"):
        return f"[{r(e.get('Values', e.get('Elements', [])))}]"
    if t == "EX_SetArray":
        return f"{r(e.get('AssigningProperty'))} = [{r(e.get('Elements', []))}]"
    if t in ("EX_DynamicCast", "EX_MetaCast", "EX_ObjToInterfaceCast", "EX_CrossInterfaceCast",
             "EX_InterfaceToObjCast"):
        return f"Cast<{short_obj(e.get('ClassPtr') or e.get('Class'))}>({r(e.get('Target'))})"
    if t in ("EX_PrimitiveCast", "EX_Cast"):
        return f"{e.get('ConversionType')}({r(e.get('Target'))})"
    if t == "EX_InstanceDelegate":
        return f"delegate<{e.get('FunctionName')}>"
    if t == "EX_BindDelegate":
        return f"bind {r(e.get('Delegate'))} -> {e.get('FunctionName')} on {r(e.get('ObjectTerm'))}"
    if t in ("EX_AddMulticastDelegate", "EX_RemoveMulticastDelegate"):
        op = "+=" if t.startswith("EX_Add") else "-="
        return f"{r(e.get('Delegate'))} {op} {r(e.get('DelegateToAdd'))}"
    if t == "EX_ClearMulticastDelegate":
        return f"clear {r(e.get('DelegateToClear'))}"
    if t == "EX_SwitchValue":
        cases = "; ".join(f"{r(c.get('CaseIndexValueTerm'))}: {r(c.get('CaseTerm'))}"
                          for c in e.get("Cases", []))
        return f"switch({r(e.get('IndexTerm'))}){{{cases}; default: {r(e.get('DefaultTerm'))}}}"
    if t == "EX_ArrayGetByRef":
        return f"{r(e.get('ArrayVariable'))}[{r(e.get('ArrayIndex'))}]"
    if t in ("EX_EndOfScript", "EX_Nothing", "EX_NothingInt32", "EX_Tracepoint",
             "EX_WireTracepoint", "EX_InstrumentationEvent"):
        return t[3:]
    # Fallback: token plus compact fields.
    rest = {k: v for k, v in e.items() if k not in ("Token", "StatementIndex")}
    return f"{t}({json.dumps(rest, ensure_ascii=False)[:300]})"


def abbreviate(v, depth=0):
    if isinstance(v, dict):
        if "ObjectName" in v and "ObjectPath" in v:
            return short_obj(v) + "  @" + v["ObjectPath"]
        return {k: abbreviate(x, depth + 1) for k, x in v.items()}
    if isinstance(v, list):
        return [abbreviate(x, depth + 1) for x in v]
    return v


def dump(path, out):
    data = json.load(open(path, encoding="utf-8"))
    out.write(f"######## {path}\n")
    for e in data:
        t, n = e.get("Type"), e.get("Name")
        if t == "BlueprintGeneratedClass":
            out.write(f"== CLASS {n}  Super={short_obj(e.get('Super'))}\n")
            for cp in e.get("ChildProperties", []) or []:
                out.write(f"   member {cp.get('Type')} {cp.get('Name')}\n")
        elif n and n.startswith("Default__"):
            out.write(f"== CDO {n}\n")
            out.write(json.dumps(abbreviate(e.get("Properties", {})), ensure_ascii=False, indent=1) + "\n")
        elif t == "Function":
            params = [f"{cp.get('Name')}:{cp.get('Type')}" for cp in e.get("ChildProperties", []) or []
                      if "Parm" in str(cp.get("PropertyFlags", ""))]
            out.write(f"\n== FUNCTION {n}({', '.join(params)})\n")
            for st in e.get("ScriptBytecode", []) or []:
                out.write(f"  {st.get('StatementIndex', '?'):>6}: {r(st)}\n")
        else:
            props = e.get("Properties")
            if props:
                out.write(f"== OBJECT {t} {n}\n")
                out.write(json.dumps(abbreviate(props), ensure_ascii=False, indent=1) + "\n")
    out.write("\n")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for p in sys.argv[1:]:
        dump(p, sys.stdout)
